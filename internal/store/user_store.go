package store

import (
	"database/sql"
	"fmt"

	"github.com/choken/quadlet-manager/internal/model"
)

type UserStore struct {
	db *sql.DB
}

func NewUserStore(db *sql.DB) *UserStore {
	return &UserStore{db: db}
}

func (s *UserStore) Create(username, passwordHash, role string) (int64, error) {
	res, err := s.db.Exec(
		"INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
		username, passwordHash, role,
	)
	if err != nil {
		return 0, fmt.Errorf("insert user: %w", err)
	}
	return res.LastInsertId()
}

func (s *UserStore) GetByID(id int64) (*model.User, error) {
	u := &model.User{}
	err := s.db.QueryRow(
		"SELECT id, username, role, created_at FROM users WHERE id = ?", id,
	).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("user %d: %w", id, err)
	}
	return u, nil
}

func (s *UserStore) GetByUsername(username string) (*model.User, error) {
	u := &model.User{}
	err := s.db.QueryRow(
		"SELECT id, username, role, created_at FROM users WHERE username = ?", username,
	).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("user %s: %w", username, err)
	}
	return u, nil
}

func (s *UserStore) GetPasswordHashByUsername(username string) (string, int64, error) {
	var hash string
	var id int64
	err := s.db.QueryRow("SELECT id, password FROM users WHERE username = ?", username).Scan(&id, &hash)
	return hash, id, err
}

// GetByUsernameWithHash returns full user info including password hash in a single query.
func (s *UserStore) GetByUsernameWithHash(username string) (*model.User, string, error) {
	u := &model.User{}
	var hash string
	err := s.db.QueryRow(
		"SELECT id, username, role, created_at, password FROM users WHERE username = ?", username,
	).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &hash)
	if err != nil {
		return nil, "", fmt.Errorf("user %s: %w", username, err)
	}
	return u, hash, nil
}

func (s *UserStore) ListAll() ([]model.User, error) {
	rows, err := s.db.Query("SELECT id, username, role, created_at FROM users ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (s *UserStore) Delete(id int64) error {
	_, err := s.db.Exec("DELETE FROM users WHERE id = ?", id)
	return err
}

func (s *UserStore) HasAdmin() bool {
	var count int
	s.db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&count)
	return count > 0
}

func (s *UserStore) UpdateRole(id int64, role string) error {
	_, err := s.db.Exec("UPDATE users SET role = ? WHERE id = ?", role, id)
	return err
}

func (s *UserStore) UpdatePassword(id int64, passwordHash string) error {
	_, err := s.db.Exec("UPDATE users SET password = ? WHERE id = ?", passwordHash, id)
	return err
}
