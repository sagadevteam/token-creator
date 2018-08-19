const HotelCal = require('./abi/HotelCal.json')
const env = require('./env')
const mysql = require('mysql')
const Web3 = require('web3')
var sleep = require('sleep')

const web3 = new Web3(new Web3.providers.HttpProvider(env.devnet.web3Url))
const HotelCalABI = HotelCal.abi
const hotel = web3.eth.contract(HotelCalABI).at(env.contractAddress)

const dbconfig = env.dbconfig

var connection = mysql.createConnection({
  host: dbconfig.host,
  user: dbconfig.user,
  password: dbconfig.password,
  database: dbconfig.database
})

connection.connect()

let targetTicketsSQL = `SELECT t.*, u.eth_addr
                        FROM tickets as t
                        INNER JOIN users as u on (t.user_id = u.user_id)
                        WHERE t.time >= (unix_timestamp() - (7 * 86400))
                        AND t.on_chain = '0'`

let updateOnChainSQL = `UPDATE tickets
                     SET on_chain = 1
                     WHERE ticket_id = ?`

let getRecentOffChainTickets = async () => {
  return new Promise((resolve, reject) => {
    connection.query(targetTicketsSQL, (error, results) => {
      if (error) {
        reject(error)
      } else {
        resolve(results)
      }
    })
  })
}

let updateToOnChain = async (ticketID) => {
  if (ticketID) {
    return new Promise((resolve, reject) => {
      connection.query(updateOnChainSQL, [ticketID], (error, results) => {
        if (error) {
          reject(error)
        } else {
          resolve(results)
        }
      })
    })
  }
}

let processTickets = async () => {
  let tickets = await getRecentOffChainTickets()
  for (let i = 0; i < tickets.length; i++) {
    console.log('Found tickets: ' + tickets.length)
    let ticket = tickets[i]
    try {
      let txHash = await hotel.mint(web3.eth.coinbase, ticket.ticket_id, 'http://google.com', { from: web3.eth.coinbase, to: hotel.address, gas: 470000 })
      console.log(txHash)
      await updateToOnChain(ticket.ticket_id)
    } catch (e) {
      console.log(e)
    }
  }
}

let main = async () => {
  while (true) {
    await processTickets()
    sleep.sleep(60)
  }
}

main()
