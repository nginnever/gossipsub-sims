const SimGSRouter = require('./index.js')
var _ = require('lodash');

// Run sim example

// load network with all routers
let routers = {}
let peers = []
let totalNodes = 26
// --Setup--
for(var i=0; i<totalNodes; i++) {
  peers.push(new SimGSRouter(10, 10, ["test0"]))
  // load network with all routers
  routers[peers[i].id] = peers[i]
}
const network = new SimGSRouter.NetworkSim({}, routers)
for(var i=0; i<totalNodes; i++) {
  peers[i].loadNetwork(network)
}

// generate boot strap info
// Store IDs (not necessary)
// peer discovery
var Trusted_p0 = {}
Trusted_p0.ids = [peers[1].id, peers[2].id]
var Trusted_p1 = {}
Trusted_p1.ids = [peers[0].id, peers[2].id]
// var Trusted_p2 = {}
// Trusted_p2.ids = [peers[0].id, peers[1].id]

// Generate score storage initial values
let tstats0 = SimGSRouter.TopicParams('test0',0, 0, 1, 0, 0, 0, true, 0, 0, 0.5)

let tmap0 = new Map()
tmap0.set(peers[0].topics[0], tstats0)
let p = []
for(var i=0; i<totalNodes; i++) {
  let tm = _.cloneDeep(tmap0)
  p[i] = SimGSRouter.Peer(peers[i].id, peers[i].topics, "test_basic", true, tm, 0, [], 0)
}

Trusted_p0.peers = [p[1]]
Trusted_p1.peers = [p[0]]
//Trusted_p0.peers = [p[1], p[2]]
//Trusted_p1.peers = [p[0], p[2]]
//Trusted_p2.peers = [p[0], p[1]]


// load peers with bootstrap nodes
// let delays = [100, 200, 150]
// peers[0].start(Trusted_p0, [100, 200])
// peers[1].start(Trusted_p1, [100, 150])
// peers[2].start(Trusted_p2, [200, 150])
peers[0].start(Trusted_p0, [100])
peers[1].start(Trusted_p1, [100])

console.log("peer0 ID: "+peers[0].id)
peers[0].peers.forEach((peer)=>{
  console.log("Peer0 peer: "+JSON.stringify(peer))
})
console.log('========')
console.log("peer1 ID: "+peers[1].id)
peers[1].peers.forEach((peer)=>{
  console.log("Peer1 peer: "+JSON.stringify(peer))
})
// console.log('========')
// console.log("peer2 ID: "+peers[2].id)
// peers[2].peers.forEach((peer)=>{
//   console.log("Peer2 peer: "+JSON.stringify(peer))
// })

// build network graph
for(var i=2; i<totalNodes; i++) {
  if(i<6){
    peers[i].join(["test0"], p[i], _.cloneDeep(p[0]))
  }
  if(i>=6 && i<10){
    peers[i].join(["test0"], p[i], _.cloneDeep(p[1]))
  }
  if(i>=10 && i<14){
    peers[i].join(["test0"], p[i], _.cloneDeep(p[2]))
  }
  if(i>=14 && i<18){
    peers[i].join(["test0"], p[i], _.cloneDeep(p[3]))
  }
  if(i>=18 && i<22){
    peers[i].join(["test0"], p[i], _.cloneDeep(p[4]))
  }
  if(i>=22 && i<26){
    peers[i].join(["test0"], p[i], _.cloneDeep(p[5]))
  }
}

peers[0].peers.forEach((peer)=>{
  console.log("Peer0 peerID: "+peer.id)
})
peers[1].peers.forEach((peer)=>{
  console.log("Peer1 peerID: "+peer.id)
})
peers[2].peers.forEach((peer)=>{
  console.log("Peer2 peerID: "+peer.id)
})

console.log("Publishing messages starting...")
let messagesSent = 2
for(var i=0; i<messagesSent; i++){
  console.log("----------------------------")
  const msg = {
    type:"block",
    id: i,
    from: peers[i].id,
    topicIDs: ["test0"],
    valid: true
  }

  peers[i].publishFlood(msg)
}

// test scoring
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function demo() {
  await sleep(2000)
  console.log(peers[0]._calculateScore(peers[1].id))
  console.log(peers[0]._calculateScore(peers[3].id))
  console.log(peers[1]._calculateScore(peers[0].id))
  console.log(peers[3]._calculateScore(peers[0].id))  

  // const msg3 = {
  //   type:"block",
  //   id: 2,
  //   from: peer3.id,
  //   topicIDs: ["test0"],
  //   valid: true
  // }

  // peer3.publishFlood(msg3)

  // await sleep(2000);

  // console.log(peer0._calculateScore(peer1.id))
  // console.log(peer0._calculateScore(peer3.id))
  // console.log(peer1._calculateScore(peer0.id))
  // console.log(peer3._calculateScore(peer0.id))

  // const msg4 = {
  //   type:"block",
  //   id: 3,
  //   from: peer2.id,
  //   topicIDs: ["test0"],
  //   valid: true
  // }

  // peer2.publishFlood(msg4)

  // await sleep(2000);

  // console.log(peer0._calculateScore(peer1.id))
  // console.log(peer0._calculateScore(peer3.id))
  // console.log(peer1._calculateScore(peer0.id))
  // console.log(peer3._calculateScore(peer0.id))  
}

demo();


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