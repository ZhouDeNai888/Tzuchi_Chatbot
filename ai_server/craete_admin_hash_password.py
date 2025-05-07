import bcrypt
password = 'admin1234'

password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

print(f"Hashed password: {password_hash}")
# Save the hashed password to a file or use it in your application