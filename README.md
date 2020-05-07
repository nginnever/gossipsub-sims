# gossipsub-sims
Simulations of the gossibsub protocol

A lightweight router that doesn't make real network connections but can simulate message delays with mock messages across mock meshes (should probably align this with filecoin/eth messages), simulate and globally record scores across all peers in the network, control the behavior with custom attack router options and examine effects on scoring. The idea is to remove the complexity of maintaining real connections and just examine the game theoretics of the scoring and message delivery times based on simulation configuration assumptions. This can more easily test nuances of attacks like covert flash. Removing the network does move this to less realistic modeling.

This implements but currently does not use the control messages, it simply assumes a push full message rather than send iHave, respond iWant, and send Messages. This is for simplicity and will be used in the future for better network delay time simulation. For now this can be factored into a total message delay time placed on messages between peers with simulated distance.

Connections are assumed made when two peers both have their counterparties peer information stored in the peers mapping. One control message GRAFT is simulated for new connections to the network