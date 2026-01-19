insert into staff_users (full_name, username, password_hash, role, active)
values ('System Administrator', 'admin', '$2b$10$gkXCI746b5rjJoOr1qCBweutOgX7pAfQ4NnEzsV4iQsw1.4UHHS8a', 'admin', true)
on conflict (username) do nothing;
