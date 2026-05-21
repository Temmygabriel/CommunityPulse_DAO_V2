// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CommunityEscrow
/// @notice Holds member USDC stakes for CommunityPulse V2.
///         Members deposit directly. Only the relay wallet can release or slash.
///         Slashed funds go to the community's registered pot address (relay wallet on testnet).
///
/// Security properties:
///   - checks-effects-interactions in releaseStake and slashStake
///   - double-stake guard: stakes[key] must be 0 before depositStake
///   - relay-only modifier on all fund movement
///   - zero-amount guard on deposit

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract CommunityEscrow {
    // ── Storage ──────────────────────────────────────────────────────────────

    // key = keccak256(abi.encodePacked(communityId, memberAddress))
    mapping(bytes32 => uint256) public stakes;

    // key = keccak256(abi.encodePacked(communityId))
    // value = address to receive slashed funds (relay wallet / community ARC pot)
    mapping(bytes32 => address) public potAddresses;

    address public relay;
    address public owner;
    IERC20 public usdc;

    // ── Events ────────────────────────────────────────────────────────────────

    event StakeDeposited(string communityId, address indexed member, uint256 amount);
    event StakeReleased(string communityId, address indexed member, uint256 amount);
    event StakeSlashed(string communityId, address indexed member, uint256 amount, address indexed pot);
    event CommunityRegistered(string communityId, address indexed potAddress);
    event RelayUpdated(address indexed oldRelay, address indexed newRelay);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyRelay() {
        require(msg.sender == relay, "CommunityEscrow: not relay");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "CommunityEscrow: not owner");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /// @param _usdc  ARC testnet USDC address (0x3600000000000000000000000000000000000000)
    /// @param _relay Relay wallet address — becomes the default pot address at deploy time
    constructor(address _usdc, address _relay) {
        require(_usdc != address(0), "CommunityEscrow: zero USDC");
        require(_relay != address(0), "CommunityEscrow: zero relay");
        usdc = IERC20(_usdc);
        relay = _relay;
        owner = msg.sender;
    }

    // ── Relay Admin ───────────────────────────────────────────────────────────

    /// @notice Called by relay after GenLayer create_community succeeds.
    ///         Registers the ARC address where slashed stakes land for this community.
    ///         On testnet: use relay wallet as potAddress (simplest, tangible slash target).
    function registerCommunity(
        string calldata communityId,
        address potAddress
    ) external onlyRelay {
        require(potAddress != address(0), "CommunityEscrow: zero pot");
        bytes32 key = keccak256(abi.encodePacked(communityId));
        potAddresses[key] = potAddress;
        emit CommunityRegistered(communityId, potAddress);
    }

    // ── Member Actions ────────────────────────────────────────────────────────

    /// @notice Member calls this directly after approving USDC transfer.
    ///         Returns the tx hash via the emitted StakeDeposited event.
    ///         Frontend stores the tx hash in localStorage immediately after this call
    ///         as the proof for GenLayer join_community.
    /// @param communityId  GenLayer community ID (e.g. "COM000001")
    /// @param member       The member address (msg.sender in typical usage)
    /// @param amount       Stake amount in USDC raw units (6 decimals, so 2 USDC = 2_000_000)
    function depositStake(
        string calldata communityId,
        address member,
        uint256 amount
    ) external {
        require(amount > 0, "CommunityEscrow: zero stake");
        bytes32 key = keccak256(abi.encodePacked(communityId, member));
        require(stakes[key] == 0, "CommunityEscrow: already staked");

        // Pull USDC from member — requires prior approve()
        bool ok = usdc.transferFrom(member, address(this), amount);
        require(ok, "CommunityEscrow: transfer failed");

        stakes[key] = amount;
        emit StakeDeposited(communityId, member, amount);
    }

    // ── Relay-Only Fund Movement ──────────────────────────────────────────────

    /// @notice Relay releases stake back to member on clean leave.
    ///         Only called after GenLayer leave_community returns true.
    function releaseStake(
        string calldata communityId,
        address member
    ) external onlyRelay {
        bytes32 key = keccak256(abi.encodePacked(communityId, member));
        uint256 amount = stakes[key];
        require(amount > 0, "CommunityEscrow: no stake");

        // effects before interactions (CEI pattern)
        stakes[key] = 0;

        bool ok = usdc.transfer(member, amount);
        require(ok, "CommunityEscrow: release failed");

        emit StakeReleased(communityId, member, amount);
    }

    /// @notice Relay slashes member stake — sends it to community pot address.
    ///         Only called after GenLayer slash_member returns true.
    function slashStake(
        string calldata communityId,
        address member
    ) external onlyRelay {
        bytes32 key = keccak256(abi.encodePacked(communityId, member));
        uint256 amount = stakes[key];
        require(amount > 0, "CommunityEscrow: no stake");

        bytes32 potKey = keccak256(abi.encodePacked(communityId));
        address pot = potAddresses[potKey];
        require(pot != address(0), "CommunityEscrow: community not registered");

        // effects before interactions (CEI pattern)
        stakes[key] = 0;

        bool ok = usdc.transfer(pot, amount);
        require(ok, "CommunityEscrow: slash transfer failed");

        emit StakeSlashed(communityId, member, amount, pot);
    }

    // ── Owner Admin ───────────────────────────────────────────────────────────

    /// @notice Update relay address. Owner only. Emits event for auditability.
    function updateRelay(address newRelay) external onlyOwner {
        require(newRelay != address(0), "CommunityEscrow: zero relay");
        address old = relay;
        relay = newRelay;
        emit RelayUpdated(old, newRelay);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /// @notice Read staked amount for a member in a community (raw USDC units, 6 decimals).
    function getStake(
        string calldata communityId,
        address member
    ) external view returns (uint256) {
        bytes32 key = keccak256(abi.encodePacked(communityId, member));
        return stakes[key];
    }

    /// @notice Read the registered pot address for a community.
    function getPotAddress(string calldata communityId) external view returns (address) {
        bytes32 key = keccak256(abi.encodePacked(communityId));
        return potAddresses[key];
    }
}
