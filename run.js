const SimGSRouter = require('./index.js')

// peer discovery
var Trusted = {}

// Run sim example

// --Setup--
const peer0 = new SimGSRouter(10, 10, ["test0", "test1"])
const peer1 = new SimGSRouter(10, 10, ["test0", "test1"])
const peer2 = new SimGSRouter(10, 10, ["test0", "test1"])
const peer3 = new SimGSRouter(10, 10, []) // dont connect bootstrap to peer3
const peer4 = new SimGSRouter(10, 10, []) // dont connect bootstrap to peer3
// load network with all routers
let routers = {}
routers[peer0.id] = peer0
routers[peer1.id] = peer1
routers[peer2.id] = peer2
routers[peer3.id] = peer3
routers[peer4.id] = peer4

const network = new SimGSRouter.NetworkSim({}, routers)
// load each peer with the network
peer0.loadNetwork(network)
peer1.loadNetwork(network)
peer2.loadNetwork(network)
peer3.loadNetwork(network)
peer4.loadNetwork(network)

// generate boot strap info
// Store IDs (not necessary)
Trusted.ids = [peer0.id, peer1.id, peer2.id]
// Generate score storage initial values
let tstats0 = SimGSRouter.TopicParams('test0',0, 0, 1, 0, 0, 0, true, 0, 0, 0.5)
let tstats1 = SimGSRouter.TopicParams('test1',0, 0, 1, 0, 0, 0, true, 0, 0, 0.5)
let tmap0 = new Map()
tmap0.set(peer0.topics[0], tstats0)
tmap0.set(peer0.topics[1], tstats1)
let p0 = SimGSRouter.Peer(peer0.id, peer0.topics, "test_basic", true, tmap0, 0, [], 0)
let p1 = SimGSRouter.Peer(peer1.id, peer1.topics, "test_basic", true, tmap0, 0, [], 0)
let p2 = SimGSRouter.Peer(peer2.id, peer2.topics, "test_basic", true, tmap0, 0, [], 0)
// add p3 later
let p3 = SimGSRouter.Peer(peer3.id, peer3.topics, "test_basic", true, tmap0, 0, [], 0)
let p4 = SimGSRouter.Peer(peer4.id, peer4.topics, "test_basic", true, tmap0, 0, [], 0)

Trusted.peers = [p0,p1, p2]
// console.log("trusted list: "+Trusted.ids)
// console.log(Trusted.peers[1])

// load peers with bootstrap nodes
peer0.start(Trusted)
peer1.start(Trusted)
peer2.start(Trusted)
peer3.start(Trusted)
Trusted.peers = [p0]
peer4.start(Trusted)

// peer0.peers.forEach((peer)=>{
//   console.log("Peer0 peer: "+peer.id)
// })

let p0mesh = peer0.mesh.get("test0")
// p0mesh.forEach((peer)=>{
//   console.log("Peer0 mesh topic 'test0' peer: "+peer.id)
// })

// not used currently
const flood = peer0.withFlooding(true);

// publish a message peer0
// console.log("peer1 mcache before msg: "+ peer1.mcache.get(0))
// console.log("peer2 mcache before msg: "+ peer2.mcache.get(0))
const msg = {
  type:"block",
  id: 0,
  from: peer0.id,
  topicIDs: ["test1"],
  valid: true
}

peer0.publishFlood(msg)
// console.log("peer1 mcache after publish: "+ JSON.stringify(peer1.mcache.get(msg.id)))
// console.log("peer2 mcache after publish: "+ JSON.stringify(peer2.mcache.get(msg.id)))
console.log("----------------------------")
// publish a message peer1
// console.log("peer0 mcache before msg: "+ peer0.mcache.get(1))
// console.log("peer2 mcache before msg: "+ peer2.mcache.get(1))
const msg2 = {
  type:"block",
  id: 1,
  from: peer1.id,
  topicIDs: ["test0"],
  valid: true
}

peer1.publishFlood(msg2)
// console.log("peer0 mcache after publish: "+ JSON.stringify(peer0.mcache.get(msg2.id)))
// console.log("peer2 mcache after publish: "+ JSON.stringify(peer2.mcache.get(msg2.id)))

// connect a new peer
let mP = peer0.mesh.get("test0")
//console.log("peer0 peers before: "+ mP)
peer3.join(["test0"], p3)
peer4.join(["test0"], p4)
//console.log("peer0 peers after: "+ mP)
//console.log("peer3 graft time on peer0: "+mP[3].topicParams.get('test0').graftTime)
//console.log(peer3._enoughPeers("test0"))

// function sleep(ms) {
//   const date = Date.now()
//   let curdate = null
//   do {
//     curdate = Date.now()
//   } while (curdate - date < ms)
// }
// sleep(3000)
// test scoring

// todo: fix this nested delay looping
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function demo() {
  sleep(2000)
  console.log(peer0._calculateScore(peer1.id))
  console.log(peer0._calculateScore(peer3.id))
  console.log(peer1._calculateScore(peer0.id))

  const msg3 = {
    type:"block",
    id: 2,
    from: peer3.id,
    topicIDs: ["test0"],
    valid: true
  }

  peer3.publishFlood(msg3)

  await sleep(2000);

  console.log(peer0._calculateScore(peer1.id))
  console.log(peer0._calculateScore(peer3.id))
  console.log(peer1._calculateScore(peer0.id))
  console.log(peer3._calculateScore(peer0.id))

  const msg4 = {
    type:"block",
    id: 3,
    from: peer2.id,
    topicIDs: ["test0"],
    valid: true
  }

  peer2.publishFlood(msg4)

  await sleep(2000);

  console.log(peer0._calculateScore(peer1.id))
  console.log(peer0._calculateScore(peer3.id))
  console.log(peer1._calculateScore(peer0.id))
  console.log(peer3._calculateScore(peer0.id))  
}

demo();

// function delay() {
//   console.log(peer0._calculateScore(peer1.id))
//   console.log(peer0._calculateScore(peer3.id))
//   console.log(peer1._calculateScore(peer0.id))

//   const msg3 = {
//     type:"block",
//     id: 2,
//     from: peer3.id,
//     topicIDs: ["test0"],
//     valid: true
//   }

//   peer3.publishFlood(msg3)

//   function delay2(){
//     console.log(peer0._calculateScore(peer1.id))
//     console.log(peer0._calculateScore(peer3.id))
//     console.log(peer1._calculateScore(peer0.id))
//     console.log(peer3._calculateScore(peer0.id))

//     // const msg4 = {
//     //   type:"block",
//     //   id: 3,
//     //   from: peer2.id,
//     //   topicIDs: ["test0"],
//     //   valid: true
//     // }

//     // peer2.publishFlood(msg4)

//     // create disconnected mesh peer, 
//     // current mesh
//     // 0-1-2-3 for all topics
//     // 4-3  
//   }
//   setTimeout(delay2, 3000)
// }
// setTimeout(delay, 2000)


// Score(p) = TopicCap(Σtᵢ*(w₁(tᵢ)*P₁(tᵢ) + w₂(tᵢ)*P₂(tᵢ) + w₃(tᵢ)*P₃(tᵢ) + w₃b(tᵢ)*P₃b(tᵢ) + w₄(tᵢ)*P₄(tᵢ))) + w₅*P₅ + w₆*P₆

// tᵢ = the topic weight for each topic where per topic parameters apply.
// P₁ = time in Mesh for a topic.
// P₂ = first Message Deliveries for a topic
// P₃ = mesh Message Delivery Rate for a topic.
// P₃b = mesh Message Delivery Failures for a topic.
// P₄ = invalid Messages for a topic.
// P₅ = application Specific score.
// P₆ = IP Colocation Factor. 

// test:
//   how long it takes a new peer to join with 0 score, given peers don't drop higher than median scored peers