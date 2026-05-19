package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/choken/quadlet-manager/internal/model"
	"github.com/choken/quadlet-manager/internal/store"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	users    *store.UserStore
	settings *store.SettingsStore
	secret   []byte
}

func NewService(db *sql.DB, jwtSecret []byte) *Service {
	return &Service{
		users:    store.NewUserStore(db),
		settings: store.NewSettingsStore(db),
		secret:   jwtSecret,
	}
}

func (s *Service) Register(username, password, role string) error {
	if username == "" || password == "" {
		return errors.New("username and password required")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	_, err = s.users.Create(username, string(hash), role)
	return err
}

func (s *Service) Login(username, password string) (string, *model.User, error) {
	user, hash, err := s.users.GetByUsernameWithHash(username)
	if err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	token, err := CreateToken(s.secret, user.ID, user.Username, user.Role, 24*time.Hour)
	if err != nil {
		return "", nil, fmt.Errorf("create token: %w", err)
	}
	return token, user, nil
}

func (s *Service) HasAdmin() bool {
	return s.users.HasAdmin()
}

func (s *Service) Users() *store.UserStore       { return s.users }
func (s *Service) Settings() *store.SettingsStore { return s.settings }
func (s *Service) Secret() []byte                 { return s.secret }
