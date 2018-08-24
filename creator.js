const env = require('./env')
const mysql = require('mysql')
const Web3 = require('web3')
let Guard = require('web3-guard')

const HotelCal = require('./abi/HotelCal.json')
const SAGAPoint = require('./abi/SAGApoint.json')

const web3 = new Web3(new Web3.providers.HttpProvider(env.web3Url))
const HotelCalABI = HotelCal.abi
const hotel = web3.eth.contract(HotelCalABI).at(env.hotelContract)

const SAGAPointABI = SAGAPoint.abi
const point = web3.eth.contract(SAGAPointABI).at(env.sagaPointContract)

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

let processTickets = async () => {
  let tickets = await getOffChainTickets()
  console.log('Found tickets: ' + tickets.length)
  for (let i = 0; i < tickets.length; i++) {
    let ticket = tickets[i]
    try {
      let tokenID = null
      let guard = new Guard(web3)
      let confirmations = 6
      guard = guard.bind(i).confirm(confirmations)
      let txHash = await hotel.mint(web3.eth.coinbase, ticket.ticket_id, 'http://google.com', web3.toWei(ticket.price),
        { from: web3.eth.coinbase, to: hotel.address, gas: 470000 })
      console.log(txHash)
      guard.listen(txHash)
      guard.on(hotel, hotel.Transfer({
        _from: '0x0000000000000000000000000000000000000000',
        _to: web3.eth.coinbase
      }).watch(async (err, event) => {
        if (err) {
          console.error(err)
        } else {
          if (!event.confirmed) {
            console.log('Unconfirmed minting ERC721 tranasction: ' + event.transactionHash)
            guard.wait(event)
          } else {
            console.log('Confirmed minting ERC721 tranasction: ' + event.transactionHash)
            tokenID = parseInt(event.args._tokenId)
            let txHash = point.mint(web3.eth.coinbase, web3.toWei(ticket.price),
              { from: web3.eth.coinbase, to: hotel.address, gas: 470000 })
            guard.listen(txHash)
          }
        }
      })).on(point, point.Mint().watch(async (err, event) => {
        if (err) {
          console.error(err)
        } else {
          if (!event.confirmed) {
            console.log('Unconfirmed minting ERC20 tranasction: ' + event.transactionHash)
            guard.wait(event)
          } else {
            await updateToOnChain(tokenID)
            console.log('Confirmed minting ERC20 for ticket: ' + tokenID + ' price: ' + ticket.price)
            guard.destroy()
          }
        }
      }))
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
  }, 86400000)
}

main()
