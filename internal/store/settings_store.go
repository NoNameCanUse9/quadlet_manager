package store

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/choken/quadlet-manager/internal/model"
)

type SettingsStore struct {
	db *sql.DB
}

func NewSettingsStore(db *sql.DB) *SettingsStore {
	return &SettingsStore{db: db}
}

func (s *SettingsStore) GetByUserID(userID int64) (*model.UserSettings, error) {
	st := &model.UserSettings{}
	err := s.db.QueryRow(`SELECT user_id, language, theme, quadlet_dir, podman_socket,
		items_per_page, auto_refresh_seconds, default_restart_policy, notify_on_failure
		FROM user_settings WHERE user_id = ?`, userID).Scan(
		&st.UserID, &st.Language, &st.Theme, &st.QuadletDir, &st.PodmanSocket,
		&st.ItemsPerPage, &st.AutoRefreshSeconds, &st.DefaultRestartPolicy, &st.NotifyOnFailure,
	)
	if err == sql.ErrNoRows {
		_, err2 := s.db.Exec("INSERT INTO user_settings (user_id) VALUES (?)", userID)
		if err2 != nil {
			return nil, fmt.Errorf("create settings: %w", err2)
		}
		return s.GetByUserID(userID)
	}
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	return st, nil
}

func (s *SettingsStore) Update(userID int64, fields map[string]interface{}) error {
	allowed := map[string]bool{
		"language": true, "theme": true, "quadlet_dir": true, "podman_socket": true,
		"items_per_page": true, "auto_refresh_seconds": true,
		"default_restart_policy": true, "notify_on_failure": true,
	}
	// Type validation per field
	stringFields := map[string]bool{"language": true, "theme": true, "quadlet_dir": true, "podman_socket": true, "default_restart_policy": true}
	intFields := map[string]bool{"items_per_page": true, "auto_refresh_seconds": true}
	boolFields := map[string]bool{"notify_on_failure": true}

	var sets []string
	var args []interface{}
	for k, v := range fields {
		if !allowed[k] {
			continue
		}
		switch {
		case stringFields[k]:
			if _, ok := v.(string); !ok {
				continue
			}
		case intFields[k]:
			switch v.(type) {
			case float64, int, int64:
				// ok
			default:
				continue
			}
		case boolFields[k]:
			if _, ok := v.(bool); !ok {
				continue
			}
		}
		sets = append(sets, k+" = ?")
		args = append(args, v)
	}
	if len(sets) == 0 {
		return nil
	}
	args = append(args, userID)
	query := fmt.Sprintf("UPDATE user_settings SET %s WHERE user_id = ?", strings.Join(sets, ", "))
	_, err := s.db.Exec(query, args...)
	return err
}
