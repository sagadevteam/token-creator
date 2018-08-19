const abi = require('./abi/HotelCal.json')
const env = require('./env')
var mysql = require('mysql')

const dbconfig = env.dbconfig

var connection = mysql.createConnection({
  host: dbconfig.host,
  user: dbconfig.user,
  password: dbconfig.password,
  database: dbconfig.database
})

connection.connect()

connection.query('SELECT * FROM users', function (error, results) {
  if (error) throw error
  results.forEach(result => {
    console.log(result.email)
  })
})
