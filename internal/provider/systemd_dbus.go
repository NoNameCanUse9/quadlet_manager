package provider

import (
	"context"
	"fmt"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/godbus/dbus/v5"
)

const (
	systemdDest = "org.freedesktop.systemd1"
	systemdPath = "/org/freedesktop/systemd1"
)

// DBusSystemdProvider implements SystemdProvider via the system/session D-Bus.
type DBusSystemdProvider struct {
	rootless bool
	conn     *dbus.Conn
}

func NewDBusSystemdProvider(rootless bool) *DBusSystemdProvider {
	return &DBusSystemdProvider{rootless: rootless}
}

func (p *DBusSystemdProvider) Connect(ctx context.Context) error {
	var conn *dbus.Conn
	var err error

	if p.rootless {
		conn, err = dbus.ConnectSessionBus(dbus.WithContext(ctx))
	} else {
		conn, err = dbus.ConnectSystemBus(dbus.WithContext(ctx))
	}
	if err != nil {
		return fmt.Errorf("dbus connect (rootless=%v): %w", p.rootless, err)
	}
	p.conn = conn
	return nil
}

func (p *DBusSystemdProvider) Close() {
	if p.conn != nil {
		p.conn.Close()
		p.conn = nil
	}
}

func (p *DBusSystemdProvider) IsRootless() bool {
	return p.rootless
}

func (p *DBusSystemdProvider) DaemonReload(ctx context.Context) error {
	if p.conn == nil {
		return fmt.Errorf("not connected")
	}
	obj := p.conn.Object(systemdDest, systemdPath)
	call := obj.CallWithContext(ctx, systemdDest+".Manager.Reload", 0)
	return call.Err
}

func (p *DBusSystemdProvider) StartUnit(ctx context.Context, name string) error {
	return p.unitAction(ctx, "StartUnit", name)
}

func (p *DBusSystemdProvider) StopUnit(ctx context.Context, name string) error {
	return p.unitAction(ctx, "StopUnit", name)
}

func (p *DBusSystemdProvider) RestartUnit(ctx context.Context, name string) error {
	return p.unitAction(ctx, "RestartUnit", name)
}

func (p *DBusSystemdProvider) unitAction(ctx context.Context, method, name string) error {
	if p.conn == nil {
		return fmt.Errorf("not connected")
	}
	obj := p.conn.Object(systemdDest, systemdPath)
	var jobPath dbus.ObjectPath
	call := obj.CallWithContext(ctx, systemdDest+".Manager."+method, 0, name, "replace")
	if err := call.Store(&jobPath); err != nil {
		return fmt.Errorf("%s %s: %w", method, name, err)
	}
	return nil
}

func (p *DBusSystemdProvider) EnableUnit(ctx context.Context, name string) error {
	return p.enableDisable(ctx, "EnableUnitFiles", name)
}

func (p *DBusSystemdProvider) DisableUnit(ctx context.Context, name string) error {
	return p.enableDisable(ctx, "DisableUnitFiles", name)
}

func (p *DBusSystemdProvider) enableDisable(ctx context.Context, method, name string) error {
	if p.conn == nil {
		return fmt.Errorf("not connected")
	}
	obj := p.conn.Object(systemdDest, systemdPath)
	call := obj.CallWithContext(ctx, systemdDest+".Manager."+method, 0,
		[]string{name}, false, true)
	return call.Err
}

func (p *DBusSystemdProvider) ListUnits(ctx context.Context) ([]model.UnitStatus, error) {
	if p.conn == nil {
		return nil, fmt.Errorf("not connected")
	}
	obj := p.conn.Object(systemdDest, systemdPath)
	call := obj.CallWithContext(ctx, systemdDest+".Manager.ListUnits", 0)
	if call.Err != nil {
		return nil, call.Err
	}

	// ListUnits returns aao(ssssssouso) — array of struct fields
	var raw []struct {
		Name        string
		Description string
		LoadState   string
		ActiveState string
		SubState    string
		Followed    string
		Path        dbus.ObjectPath
		JobID       uint32
		JobType     string
		JobPath     dbus.ObjectPath
	}
	if err := call.Store(&raw); err != nil {
		return nil, fmt.Errorf("store ListUnits: %w", err)
	}

	var units []model.UnitStatus
	for _, u := range raw {
		// Filter: only .service units that look like Quadlet-managed
		if !strings.HasSuffix(u.Name, ".service") &&
			!strings.HasSuffix(u.Name, ".volume") &&
			!strings.HasSuffix(u.Name, ".network") &&
			!strings.HasSuffix(u.Name, ".pod") &&
			!strings.HasSuffix(u.Name, ".image") {
			continue
		}
		units = append(units, model.UnitStatus{
			Name:        u.Name,
			Description: u.Description,
			LoadState:   u.LoadState,
			ActiveState: u.ActiveState,
			SubState:    u.SubState,
		})
	}
	return units, nil
}

func (p *DBusSystemdProvider) GetUnitStatus(ctx context.Context, name string) (*model.UnitStatus, error) {
	if p.conn == nil {
		return nil, fmt.Errorf("not connected")
	}

	// Get the unit object path
	obj := p.conn.Object(systemdDest, systemdPath)
	var unitPath dbus.ObjectPath
	call := obj.CallWithContext(ctx, systemdDest+".Manager.GetUnit", 0, name)
	if err := call.Store(&unitPath); err != nil {
		return nil, fmt.Errorf("GetUnit %s: %w", name, err)
	}

	// Read properties
	unitObj := p.conn.Object(systemdDest, unitPath)
	loadState, _ := p.getStringProperty(ctx, unitObj, systemdDest+".Unit.LoadState")
	activeState, _ := p.getStringProperty(ctx, unitObj, systemdDest+".Unit.ActiveState")
	subState, _ := p.getStringProperty(ctx, unitObj, systemdDest+".Unit.SubState")
	desc, _ := p.getStringProperty(ctx, unitObj, systemdDest+".Unit.Description")

	return &model.UnitStatus{
		Name:        name,
		Description: desc,
		LoadState:   loadState,
		ActiveState: activeState,
		SubState:    subState,
	}, nil
}

func (p *DBusSystemdProvider) getStringProperty(ctx context.Context, obj dbus.BusObject, prop string) (string, error) {
	call := obj.CallWithContext(ctx, "org.freedesktop.DBus.Properties.Get", 0, prop, "")
	if call.Err != nil {
		return "", call.Err
	}
	var val string
	if err := call.Store(&val); err != nil {
		return "", err
	}
	return val, nil
}

func (p *DBusSystemdProvider) SubscribeUnitChanges(ctx context.Context) (<-chan model.UnitChangeEvent, error) {
	if p.conn == nil {
		return nil, fmt.Errorf("not connected")
	}

	// Subscribe to systemd signals
	if err := p.conn.AddMatchSignal(
		dbus.WithMatchInterface(systemdDest+".Manager"),
		dbus.WithMatchMember("UnitNew"),
	); err != nil {
		return nil, fmt.Errorf("add match signal: %w", err)
	}

	ch := make(chan model.UnitChangeEvent, 16)
	go func() {
		defer close(ch)
		sigChan := make(chan *dbus.Signal, 16)
		p.conn.Signal(sigChan)
		defer p.conn.RemoveSignal(sigChan)

		for {
			select {
			case <-ctx.Done():
				return
			case sig, ok := <-sigChan:
				if !ok {
					return
				}
				if len(sig.Body) >= 2 {
					if name, ok := sig.Body[0].(string); ok {
						if path, ok := sig.Body[1].(dbus.ObjectPath); ok && path != "/" {
							ch <- model.UnitChangeEvent{
								Name:   name,
								Status: "changed",
							}
						}
					}
				}
			}
		}
	}()

	return ch, nil
}
