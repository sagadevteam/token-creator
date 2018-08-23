const HotelCal = require('./abi/HotelCal.json')
const env = require('./env')
const mysql = require('mysql')
const Web3 = require('web3')
let Guard = require('web3-guard')

const web3 = new Web3(new Web3.providers.HttpProvider(env.web3Url))
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

let targetTicketsSQL = `SELECT t.*, u.eth_addr, i.price
                        FROM tickets as t
                        LEFT JOIN users as u on (t.user_id = u.user_id)
                        INNER JOIN inventories as i on (i.inventory_id = t.inventory_id)
                        WHERE t.on_chain = '0'`

let updateOnChainSQL = `UPDATE tickets
                     SET on_chain = 1
                     WHERE ticket_id = ?`

let getOffChainTickets = async () => {
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

let guard = new Guard(web3)
let confirmations = 6
guard = guard.bind('1122').confirm(confirmations)
guard.on(hotel, hotel.Transfer({
  _from: '0x0000000000000000000000000000000000000000',
  _to: web3.eth.coinbase
}).watch(async (err, event) => {
  if (err) {
    console.error(err)
  } else {
    if (!event.confirmed) {
      console.log('Not confirm mint tranasction: ' + event.transactionHash)
      guard.wait(event)
    } else {
      console.log('Confirm mint tranasction: ' + event.transactionHash)
      let tokenID = parseInt(event.args._tokenId)
      await updateToOnChain(tokenID)
      console.log('Update token status to on-chain: ' + tokenID)
    }
  }
}))

let processTickets = async () => {
  let tickets = await getOffChainTickets()
  for (let i = 0; i < tickets.length; i++) {
    console.log('Found tickets: ' + tickets.length)
    let ticket = tickets[i]
    try {
      let txHash = await hotel.mint(web3.eth.coinbase, ticket.ticket_id, 'http://google.com', ticket.price,
        { from: web3.eth.coinbase, to: hotel.address, gas: 470000 })
      console.log(txHash)
      guard.listen(txHash)
    } catch (e) {
      console.log(e)
    }
  }
}

let main = async () => {
  console.log('Wait for uploading tickets...')
  await processTickets()
  setInterval(async () => {
    console.log('Wait for uploading tickets...')
    await processTickets()
  }, 86400)
}

main()
