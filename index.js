var Struct = require('struct');

// overlay parameters
const GossipSubD = 6
const GossipSubDlo = 5
const GossipSubDhi = 12
const GossipSubDscore = 4
// gossip parameters
const GossipSubHistoryLength = 5
const GossipSubHistoryGossip = 3
const GossipSubDlazy = 6
const GossipSubGossipFactor = 0.25
const GossipSubGossipRetransmission = 3
// heartbeat interval
const GossipSubHeartbeatInitialDelay = 100 //* time.Millisecond
const GossipSubHeartbeatInterval = 1000 //* time.Millisecond
// fanout ttl
const GossipSubFanoutTTL = 60 //* time.Second
// number of peers to include in prune Peer eXchange
const GossipSubPrunePeers = 16
// backoff time for pruned peers
const GossipSubPruneBackoff = 1 //*time.Minute
// number of active connection attempts for peers obtained through px
const GossipSubConnectors = 8
// maximum number of pending connections for peers attempted through px
const GossipSubMaxPendingConnections = 128
// timeout for connection attempts
const GossipSubConnectionTimeout = 30 //* time.Second
// Number of heartbeat ticks for attempting to reconnect direct peers that are not
// currently connected
const GossipSubDirectConnectTicks = 300
// Initial delay before opening connections to direct peers
const GossipSubDirectConnectInitialDelay = 1 //*time.Second
// Number of heartbeat ticks for attempting to improve the mesh with opportunistic
// grafting
const GossipSubOpportunisticGraftTicks = 60
// Number of peers to opportunistically graft
const GossipSubOpportunisticGraftPeers = 2
// If a GRAFT comes before GossipSubGraftFloodThreshold has ellapsed since the last PRUNE,
// then there is no PRUNE response emitted. This protects against GRAFT floods and should be
// less than GossipSubPruneBackoff.
const GossipSubGraftFloodThreshold = 10 //* time.Second
// backoff penalty for GRAFT floods
const GossipSubPruneBackoffPenalty = 1//* time.Hour
// Maximum number of messages to include in an IHAVE message. Also controls the maximum
// number of IHAVE ids we will accept and request with IWANT from a peer within a heartbeat,
// to protect from IHAVE floods. You should adjust this value from the default if your
// system is pushing more than 5000 messages in GossipSubHistoryGossip heartbeats; with the
// defaults this is 1666 messages/s.
const GossipSubMaxIHaveLength = 5000
// Maximum number of IHAVE messages to accept from a peer within a heartbeat.
const GossipSubMaxIHaveMessages = 10

// threshholds
const GossipThreshold = 0
const PublishThreshold = -1
const GraylistThreshold = -2
const AcceptPXThreshold = 1
const OpportunisticGraftThreshold = 1
const DecayInterval = 1// * hour
const DecayToZero = 0.1
const RetainScore = 1// * day

var Trusted = {}

function Peer(
  id,
  topics, // a list of topics this peer subs to
  protocols,
  isWritable,
  timeinMesh,
  firstMessageDeliveries,
  meshMessageDeliveryRate,
  invalidMessages,
  applicationSpecific,
  IPColocationFactor
  ) {
  return {
    id:id,
    topics:topics,
    protocols:protocols,
    isWritable:isWritable,
    // scoring
    timeinMesh:timeinMesh,
    firstMessageDeliveries:firstMessageDeliveries,
    meshMessageDeliveryRate:meshMessageDeliveryRate,
    invalidMessages:invalidMessages,
    applicationSpecific:applicationSpecific,
    IPColocationFactor:IPColocationFactor
  }
}

// A peer score simulated router
class SimGSRouter {
  constructor(peerScoreParams, peerScoreThresholds) {

    this.id = Math.floor(10000*Math.random())
    this.FloodSubID = "test_basic"
    this.topics = ["test0", "test1"]
    this.mcache = {}
    this.gossipOn = true// false will disable this router from gossiping incoming messages
    this.peers = [0,1]
    this.mesh = new Map()//     make(map[string]map[peer.ID]struct{}),
    this.fanout = {}//   make(map[string]map[peer.ID]struct{}),
    this.lastpub = {}//  make(map[string]int64),
    this.gossip = "func"//   make(map[peer.ID][]*pb.ControlIHave),
    this.control = "func"//  make(map[peer.ID]*pb.ControlMessage),
    this.backoff = {}//  make(map[string]map[peer.ID]time.Time),
    this.peerhave = {}// make(map[peer.ID]int),
    this.iasked = {}//   make(map[peer.ID]int),
    this.connect = {}//  make(chan connectInfo, GossipSubMaxPendingConnections),
    this.mcache = {}//   NewMessageCache(GossipSubHistoryGossip, GossipSubHistoryLength),

    // these are configured per router to allow variation in tests
    this.D = GossipSubD
    this.Dlo = GossipSubDlo
    this.Dhi = GossipSubDhi
    this.Dscore = GossipSubDscore
    this.Dlazy = GossipSubDlazy

    // these must be pulled in to resolve races in tests... sigh.
    this.directConnectTicks = GossipSubDirectConnectTicks
    this.opportunisticGraftTicks = GossipSubOpportunisticGraftTicks

    this.fanoutTTL = GossipSubFanoutTTL

    // Scoring params
    this.score = peerScoreParams.Score
    this.gossipThreshold = peerScoreThresholds.GossipThreshold
    this.publishThreshold = peerScoreThresholds.PublishThreshold
    this.graylistThreshold = peerScoreThresholds.GraylistThreshold
    this.acceptPXThreshold = peerScoreThresholds.AcceptPXThreshold
    this.opportunisticGraftThreshold = peerScoreThresholds.OpportunisticGraftThreshold

    // Router options
    this.withFlood = false
    this.doPX = false
    this.directPeers = {}

    // stats
    this.messagesReceived = 0
    this.messagesSent = 0
    this.messagesOriginated = 0

  }

  attach() {
    // start heartbeats
    console.log("starting heartbeat for peer: "+this.id)
    this.heartbeat()
    // get peers
    this.peers = Trusted.peers
    // get init scores for all peers

    // create initial mesh
    this.peers.forEach((peer)=>{
      peer.topics.forEach((topic)=>{
        let mTopic = this.mesh.get(topic)
        if(!mTopic){
          this.mesh.set(topic, [peer])
        } else {
          mTopic.push(peer)
          this.mesh.set(topic, mTopic)
        }
      })
    })

  }
  // heartbeat management
  heartbeat() {
    var id = this.id
    function beat() {
      console.log("ID: "+id+" beat")
      // -- gossip --


      // -- scoring --
      // calculate score
      // remove peers from mesh if below threshold
      // prune oversubscription, keep best `D_Score` peers and select others at random
      // graft if undersubscribed, avoid connecting to negative scored peers

      // log score to global stats
    }
    //console.log("ID: "+this.id+" beat")
    setInterval(beat, GossipSubHeartbeatInterval)
  }

  withFlooding(bool) {
    this.withFlood = bool
    return this.withFlood
  }

  withPX(bool) {
    this.doPX = bool
    return this.doPX
  }

  withDirectPeers(peerArray) {
    this.directPeers = peerArray
  }

  toggleGossip(bool) {
    this.gossipOn = bool
  } 

  // Actions
  handleRPCMessage(msg, from) {
    console.log("Peer: "+this.id+" received a message from: "+from+ " msg_id: "+msg.id)
    const topics = msg.topicIDs

    if(this.mcache[msg.id] === msg) {
      return // already seen do not forward?
    } else {
      this.mcache[msg.id] = msg
    }

    // do not emit incoming messages to peers
    if(this.noGossip) {
      return
    }
    //return

    // Flood publish
    this.peers.forEach((peer) => {
      if (peer.protocols.includes(this.FloodSubID) &&
        peer.id !== msg.from &&
        peer.id !== from &&
        peer.id !== this.id &&
        this.anyMatch(peer.topics, topics) &&
        peer.isWritable
      ) {
        console.log("flooding message to all peers")
        this.network.relayMsg(msg, peer.id, this.id)
        //this.log('publish msg on topics - floodsub', topics, peer.id)
      }
    })

    // Emit to peers in the mesh
    topics.forEach((topic) => {
      if (!this.mesh.has(topic)) {
        return
      }
      this.mesh.get(topic).forEach((peer) => {
        if (!peer.isWritable || 
          peer.id === msg.from || 
          peer.id === from ||
          peer.id === this.id
          ) {
          return
        }
        console.log(this.id+" is attempting to forward to mesh: "+topic+" for peer: "+peer.id)
        this.network.relayMsg(msg, peer.id, this.id)
      })
    })

  }

  publishFlood(msg) {
    console.log("Peer: "+msg.from+" orgininating msg: "+msg.id)
    const topics = msg.topicIDs
    this.mcache[msg.id] = msg

    this.peers.forEach((peer) => {
      console.log("looking for peer to publish to")
      if (peer.protocols.includes(this.FloodSubID) &&
        peer.id !== this.id &&
        this.anyMatch(peer.topics, topics) &&
        peer.isWritable
      ) {
        console.log("relaying msg to: "+peer.id)
        this.network.relayMsg(msg, peer.id, this.id)
        //this.log('publish msg on topics - floodsub', topics, peer.id)
      }
    })
    this.network
  }

  flood(msg) {

  }

  sendIHAVE() {

  }

  handleIHAVE() {

  }

  loadNetwork(net) {
    this.network = net
  }

  _removePeer(p) {
    this.peers.forEach((peer)=>{
      if(peer.id === p.id){
        peer = {}
      } else {
        console.log("could not find peer to delete")
      }
    })
  }

  anyMatch(a, b) {
    let bHas
    if (Array.isArray(b)) {
      bHas = (val) => b.indexOf(val) > -1
    } else {
      bHas = (val) => b.has(val)
    }

    for (const val of a) {
      if (bHas(val)) {
        return true
      }
    }

    return false
  }
}

class NetworkSim {
  constructor(options, routers) {
    this.options = options
    this.routers = routers
  }


  relayMsg(msg, to, from) {
    // can delay messages here conditionally, maybe based on simulated distance between sender/rec
    //console.log(this.routers)
    this.routers[to].handleRPCMessage(msg, from)
  }
}

// Run sim example

// --Setup--
const peer0 = new SimGSRouter(10, 10)
const peer1 = new SimGSRouter(10, 10)
const peer2 = new SimGSRouter(10, 10)
// load network with all routers
let routers = {}
routers[peer0.id] = peer0
routers[peer1.id] = peer1
routers[peer2.id] = peer2

const network = new NetworkSim({}, routers)
// load each peer with the network
peer0.loadNetwork(network)
peer1.loadNetwork(network)
peer2.loadNetwork(network)

// generate boot strap info
Trusted.ids = [peer0.id, peer1.id, peer2.id]
let p0 = Peer(peer0.id, peer0.topics, "test_basic", true, 0, 0, 0, 0, 0, 0)
let p1 = Peer(peer1.id, peer1.topics, "test_basic", true, 0, 0, 0, 0, 0, 0)
let p2 = Peer(peer2.id, peer2.topics, "test_basic", true, 0, 0, 0, 0, 0, 0)
Trusted.peers = [p0,p1, p2]
console.log("trusted list: "+Trusted.ids)
console.log(Trusted.peers[1])
// load peers with bootstrap nodes
peer0.attach()
peer1.attach()
peer2.attach()
console.log("Peer0 peers: "+peer0.peers)
let p0mesh = peer0.mesh.get("test0")
console.log("Peer0 Mesh Topic test0: "+p0mesh)

// not used currently
const flood = peer0.withFlooding(true);

// send a message
console.log("peer1 mcache before msg: "+ peer1.mcache[0])
console.log("peer2 mcache before msg: "+ peer2.mcache[0])
const msg = {
  id: 0,
  from: peer0.id,
  topicIDs: ["test1"]
}

peer0.publishFlood(msg)
console.log("peer1 mcache after publish: "+ peer1.mcache[0])
console.log("peer2 mcache after publish: "+ peer2.mcache[0])
//console.log()

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
