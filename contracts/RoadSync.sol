// SPDX-License-Identifier: MIT
// 0.8.19 on purpose: newer versions may emit opcodes an older testnet doesn't support.
pragma solidity ^0.8.19;

contract RoadSync {
    // The agency wallet that is allowed to approve work orders.
    address public agency;

    // Counts work orders. The first one gets id 1.
    uint public nextId = 1;

    // Tracks if a work order exists and if it has an open (unresolved) conflict.
    mapping(uint => bool) public exists;
    mapping(uint => bool) public conflictOpen;
    mapping(uint => bool) public approved;

    // Events = the tamper-proof history. Each stores id, hash, sender, time.
    event WorkOrderSubmitted(uint indexed id, bytes32 hash, address sender, uint timestamp);
    event ConflictRecorded(uint indexed id, bytes32 hash, address sender, uint timestamp);
    event ConflictResolved(uint indexed id, bytes32 hash, address sender, uint timestamp);
    event WorkOrderApproved(uint indexed id, bytes32 hash, address sender, uint timestamp);

    // Runs once at deploy. Whoever deploys becomes the agency.
    constructor() {
        agency = msg.sender;
    }

    // Worker submits a work order. `hash` is a fingerprint of the order data.
    function submitWorkOrder(bytes32 hash) external returns (uint id) {
        id = nextId;
        nextId++;
        exists[id] = true;
        emit WorkOrderSubmitted(id, hash, msg.sender, block.timestamp);
    }

    // A conflict was found: mark it open.
    function recordConflict(uint id, bytes32 hash) external {
        require(exists[id], "Unknown work order");
        conflictOpen[id] = true;
        emit ConflictRecorded(id, hash, msg.sender, block.timestamp);
    }

    // Worker accepted the reroute or window: mark it resolved.
    function resolveConflict(uint id, bytes32 hash) external {
        require(exists[id], "Unknown work order");
        conflictOpen[id] = false;
        emit ConflictResolved(id, hash, msg.sender, block.timestamp);
    }

    // Only the agency can approve, and only if no conflict is still open.
    function approveWorkOrder(uint id, bytes32 hash) external {
        require(msg.sender == agency, "Only agency");
        require(exists[id], "Unknown work order");
        require(!conflictOpen[id], "Conflict unresolved");
        require(!approved[id], "Already approved");
        approved[id] = true;
        emit WorkOrderApproved(id, hash, msg.sender, block.timestamp);
    }
}