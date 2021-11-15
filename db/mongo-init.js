print('Creating user')
db.createUser({
  user: 'nexomiaDev',
  pwd: 'deNewOxima1202',
  roles: [
    {
      role: 'readWrite',
      db: 'NexomiaNew',
    },
  ],
})
