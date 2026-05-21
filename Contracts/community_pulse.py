# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# CommunityPulse V2 — GenLayer Smart Contract
#
# Changes from V1:
#   - create_community: new param `member_stake` (str, converted internally)
#   - join_community: new param `arc_tx_hash` (must be non-empty to pass gate)
#   - NEW: leave_community → returns bool
#   - NEW: slash_member    → returns bool (founder-only)
#
# Unchanged from V1 (do NOT touch):
#   - evaluate_proposal and its entire AI pipeline
#   - add_pulse, submit_proposal, revise_proposal, deposit_funds
#   - all view methods
#   - the u256 arithmetic pattern
#   - the defensive JSON parsing pattern

import genlayer.gl as gl
from genlayer import TreeMap, u256
import json


class CommunityPulse(gl.Contract):

    community_count: u256
    proposal_count: u256
    communities: TreeMap[str, str]           # community_id → JSON
    proposals: TreeMap[str, str]             # proposal_id → JSON
    community_proposals: TreeMap[str, str]   # community_id → [proposal_ids] JSON
    member_proposals: TreeMap[str, str]      # address → [proposal_ids] JSON
    community_members: TreeMap[str, str]     # community_id → [addresses] JSON
    proposal_pulses: TreeMap[str, str]       # proposal_id → [addresses] JSON

    def __init__(self):
        self.community_count = u256(0)
        self.proposal_count = u256(0)

    # ----------------------------------------------------------------
    # Internal helpers — unchanged from V1
    # ----------------------------------------------------------------

    def _make_community_id(self) -> str:
        self.community_count = u256(int(self.community_count) + 1)
        n = int(self.community_count)
        return "COM" + str(n).zfill(6)

    def _make_proposal_id(self) -> str:
        self.proposal_count = u256(int(self.proposal_count) + 1)
        n = int(self.proposal_count)
        return "PRO" + str(n).zfill(6)

    def _read_community(self, community_id: str) -> dict:
        return json.loads(self.communities[community_id])

    def _write_community(self, community_id: str, data: dict) -> None:
        self.communities[community_id] = json.dumps(data)

    def _read_proposal(self, proposal_id: str) -> dict:
        return json.loads(self.proposals[proposal_id])

    def _write_proposal(self, proposal_id: str, data: dict) -> None:
        self.proposals[proposal_id] = json.dumps(data)

    def _get_community_proposals(self, community_id: str) -> list:
        raw = self.community_proposals.get(community_id)
        if raw is None:
            return []
        return json.loads(raw)

    def _set_community_proposals(self, community_id: str, ids: list) -> None:
        self.community_proposals[community_id] = json.dumps(ids)

    def _get_member_proposals(self, address: str) -> list:
        raw = self.member_proposals.get(address)
        if raw is None:
            return []
        return json.loads(raw)

    def _set_member_proposals(self, address: str, ids: list) -> None:
        self.member_proposals[address] = json.dumps(ids)

    def _get_community_members(self, community_id: str) -> list:
        raw = self.community_members.get(community_id)
        if raw is None:
            return []
        return json.loads(raw)

    def _set_community_members(self, community_id: str, members: list) -> None:
        self.community_members[community_id] = json.dumps(members)

    def _get_proposal_pulses(self, proposal_id: str) -> list:
        raw = self.proposal_pulses.get(proposal_id)
        if raw is None:
            return []
        return json.loads(raw)

    def _set_proposal_pulses(self, proposal_id: str, addresses: list) -> None:
        self.proposal_pulses[proposal_id] = json.dumps(addresses)

    def _is_member(self, community_id: str, address: str) -> bool:
        members = self._get_community_members(community_id)
        return address in members

    # ----------------------------------------------------------------
    # Public write methods
    # ----------------------------------------------------------------

    @gl.public.write
    def create_community(
        self,
        founder_address: str,
        founder_name: str,
        community_name: str,
        description: str,
        constitution_purpose: str,
        constitution_always_fund: str,
        constitution_never_fund: str,
        constitution_who_benefits: str,
        constitution_success: str,
        initial_pot: str,
        funding_threshold: str,
        max_proposal_pct: str,
        proposal_fee: str,
        member_stake: str          # V2 NEW — USDC required to join (string, converted internally)
    ) -> str:
        community_id = self._make_community_id()

        pot = int(initial_pot)
        threshold = int(funding_threshold)
        max_pct = int(max_proposal_pct)
        fee = int(proposal_fee)
        stake = int(member_stake)  # V2 — whole USDC units (e.g. 2 for 2 USDC)

        community = {
            "id": community_id,
            "name": community_name,
            "description": description,
            "founder": founder_address,
            "founder_name": founder_name,
            "constitution": {
                "purpose": constitution_purpose,
                "always_fund": constitution_always_fund,
                "never_fund": constitution_never_fund,
                "who_benefits": constitution_who_benefits,
                "success_looks_like": constitution_success,
            },
            "pot_balance": pot,
            "funding_threshold": threshold,
            "max_proposal_pct": max_pct,
            "proposal_fee": fee,
            "member_stake": stake,          # V2 NEW
            "member_count": 1,
            "proposal_count": 0,
            "funded_count": 0,
            "total_funded": 0,
            "status": "active",
            "created_at": int(self.community_count),
        }

        self._write_community(community_id, community)
        self._set_community_proposals(community_id, [])
        self._set_community_members(community_id, [founder_address])

        return community_id

    @gl.public.write
    def join_community(
        self,
        community_id: str,
        member_address: str,
        member_name: str,
        arc_tx_hash: str       # V2 NEW — ARC stake deposit proof (non-empty gate)
    ) -> None:
        # V2 gate: hash must be non-empty.
        # Note: this is a soft gate — any non-empty string passes.
        # A bad actor could pass a fake hash. Acceptable for testnet.
        # Production replacement: oracle verification of ARC event log.
        if not arc_tx_hash:
            return

        community = self._read_community(community_id)

        # Must be active — frontend checks this BEFORE triggering the ARC deposit
        # to prevent members depositing stake on a depleted/paused community.
        if community["status"] != "active":
            return

        members = self._get_community_members(community_id)
        if member_address in members:
            return

        members.append(member_address)
        self._set_community_members(community_id, members)

        community["member_count"] = community["member_count"] + 1
        self._write_community(community_id, community)

    @gl.public.write
    def leave_community(
        self,
        community_id: str,
        member_address: str
    ) -> bool:
        """
        Member exits voluntarily. Founder cannot leave (they own the community).
        Frontend calls ARC releaseStake only after this returns True.
        Returns False if: community not found, member not in community, member is founder.
        """
        community = self._read_community(community_id)

        # Founder cannot leave — they created and own this community
        if community["founder"] == member_address:
            return False

        members = self._get_community_members(community_id)
        if member_address not in members:
            return False

        members.remove(member_address)
        self._set_community_members(community_id, members)
        community["member_count"] = community["member_count"] - 1
        self._write_community(community_id, community)
        return True

    @gl.public.write
    def slash_member(
        self,
        community_id: str,
        caller_address: str,
        target_address: str
    ) -> bool:
        """
        Founder removes a member and forfeits their stake.
        Known centralisation: only the founder can slash. Accepted for testnet.
        Frontend calls ARC slashStake only after this returns True.
        Returns False if: not founder calling, target is founder, target not a member.
        """
        community = self._read_community(community_id)

        # Only founder can slash
        if community["founder"] != caller_address:
            return False

        # Founder cannot slash themselves
        if target_address == community["founder"]:
            return False

        members = self._get_community_members(community_id)
        if target_address not in members:
            return False

        members.remove(target_address)
        self._set_community_members(community_id, members)
        community["member_count"] = community["member_count"] - 1
        self._write_community(community_id, community)
        return True

    @gl.public.write
    def deposit_funds(
        self,
        community_id: str,
        depositor_address: str,
        amount: str
    ) -> None:
        community = self._read_community(community_id)
        amt = int(amount)
        community["pot_balance"] = community["pot_balance"] + amt
        if community["status"] == "depleted" and community["pot_balance"] > 0:
            community["status"] = "active"
        self._write_community(community_id, community)

    @gl.public.write
    def submit_proposal(
        self,
        community_id: str,
        proposer_address: str,
        proposer_name: str,
        title: str,
        amount: str,
        what_it_does: str,
        who_it_helps: str,
        success_metric: str,
        timeline: str
    ) -> str:
        community = self._read_community(community_id)

        # Must be a member
        if not self._is_member(community_id, proposer_address):
            return ""

        # Pot must cover proposal fee
        fee = community["proposal_fee"]
        if community["pot_balance"] < fee:
            return ""

        # Amount must not exceed max_proposal_pct of pot
        amt = int(amount)
        max_allowed = (community["pot_balance"] * community["max_proposal_pct"]) // 100
        if amt > max_allowed:
            return ""

        proposal_id = self._make_proposal_id()

        # Deduct proposal fee from pot
        community["pot_balance"] = community["pot_balance"] - fee
        community["proposal_count"] = community["proposal_count"] + 1
        self._write_community(community_id, community)

        proposal = {
            "id": proposal_id,
            "community_id": community_id,
            "proposer": proposer_address,
            "proposer_name": proposer_name,
            "title": title,
            "amount": amt,
            "what_it_does": what_it_does,
            "who_it_helps": who_it_helps,
            "success_metric": success_metric,
            "timeline": timeline,
            "status": "pending",
            "is_revision": False,
            "original_proposal_id": None,
            "pulse_count": 0,
            "pulse_bonus": 0,
            "base_score": None,
            "total_score": None,
            "principle_scores": {
                "purpose_alignment": None,
                "community_benefit": None,
                "constitutional_fit": None,
                "feasibility": None,
                "value_for_money": None,
            },
            "recommendation": None,
            "reasoning": None,
            "concerns": None,
            "revision_count": 0,
            "created_at": int(self.proposal_count),
        }

        self._write_proposal(proposal_id, proposal)
        self._set_proposal_pulses(proposal_id, [])

        community_props = self._get_community_proposals(community_id)
        community_props.append(proposal_id)
        self._set_community_proposals(community_id, community_props)

        member_props = self._get_member_proposals(proposer_address)
        member_props.append(proposal_id)
        self._set_member_proposals(proposer_address, member_props)

        return proposal_id

    @gl.public.write
    def add_pulse(
        self,
        proposal_id: str,
        member_address: str
    ) -> None:
        proposal = self._read_proposal(proposal_id)

        if proposal["status"] not in ("pending", "scoring", "scored"):
            return

        community_id = proposal["community_id"]

        if not self._is_member(community_id, member_address):
            return

        pulses = self._get_proposal_pulses(proposal_id)
        if member_address in pulses:
            return

        pulses.append(member_address)
        self._set_proposal_pulses(proposal_id, pulses)

        proposal["pulse_count"] = proposal["pulse_count"] + 1
        self._write_proposal(proposal_id, proposal)

    @gl.public.write
    def evaluate_proposal(self, proposal_id: str) -> None:
        proposal = self._read_proposal(proposal_id)

        if proposal["status"] != "pending":
            return

        community_id = proposal["community_id"]
        community = self._read_community(community_id)

        proposal["status"] = "scoring"
        self._write_proposal(proposal_id, proposal)

        constitution = community["constitution"]
        pot_balance = community["pot_balance"]
        member_count = community["member_count"]
        funding_threshold = community["funding_threshold"]

        prompt = (
            "You are evaluating a funding proposal for a community treasury.\n\n"
            "COMMUNITY CONSTITUTION:\n"
            "Purpose: " + constitution["purpose"] + "\n"
            "We always fund: " + constitution["always_fund"] + "\n"
            "We never fund: " + constitution["never_fund"] + "\n"
            "Who benefits: " + constitution["who_benefits"] + "\n"
            "Success looks like: " + constitution["success_looks_like"] + "\n\n"
            "PROPOSAL:\n"
            "Title: " + proposal["title"] + "\n"
            "Amount requested: " + str(proposal["amount"]) +
            " (total pot: " + str(pot_balance) + ")\n"
            "What it does: " + proposal["what_it_does"] + "\n"
            "Who it helps: " + proposal["who_it_helps"] + "\n"
            "Success metric: " + proposal["success_metric"] + "\n"
            "Timeline: " + proposal["timeline"] + "\n"
            "Community pulse signals: " + str(proposal["pulse_count"]) +
            " members expressed support out of " + str(member_count) + " total members\n\n"
            "Score this proposal 0-100 on each of these five principles:\n"
            "- purpose_alignment: does it match the stated community purpose?\n"
            "- community_benefit: does it benefit the majority of members?\n"
            "- constitutional_fit: does it respect the always/never fund rules?\n"
            "- feasibility: is the timeline and success metric realistic?\n"
            "- value_for_money: is the amount reasonable for the stated outcome?\n\n"
            "Base score = average of the five principle scores.\n"
            "Pulse bonus = up to 5 points based on pulse_count relative to member count.\n"
            "Total score = base score + pulse bonus. Maximum 100.\n\n"
            "Recommendation rules:\n"
            "- FUND if total_score >= " + str(funding_threshold) + "\n"
            "- REVISE if total_score is 50 to " + str(funding_threshold - 1) + "\n"
            "- REJECT if total_score < 50\n\n"
            "Return ONLY a JSON object starting with { and ending with }. "
            "No markdown, no preamble.\n"
            'Format: {"base_score": 72, "pulse_bonus": 3, "total_score": 75, '
            '"principle_scores": {"purpose_alignment": 80, "community_benefit": 75, '
            '"constitutional_fit": 90, "feasibility": 60, "value_for_money": 70}, '
            '"recommendation": "FUND", "reasoning": "one sentence explaining verdict", '
            '"concerns": "one sentence on what is weak or missing"}'
        )

        def generate():
            return gl.nondet.exec_prompt(prompt)

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="evaluate a community treasury funding proposal against a constitution",
            criteria="valid JSON with base_score, pulse_bonus, total_score, principle_scores, recommendation, reasoning, and concerns"
        )

        # Defensive JSON parsing — do not change this pattern
        result_json = {}
        try:
            start = result_raw.find("{")
            end = result_raw.rfind("}") + 1
            if start >= 0 and end > start:
                result_json = json.loads(result_raw[start:end])
        except Exception:
            result_json = {}

        total_score = result_json.get("total_score", 0)
        base_score = result_json.get("base_score", 0)
        pulse_bonus = result_json.get("pulse_bonus", 0)
        principle_scores = result_json.get("principle_scores", {})
        recommendation = result_json.get("recommendation", "REJECT")
        reasoning = result_json.get("reasoning", "")
        concerns = result_json.get("concerns", "")

        # Re-read after AI call (state may have changed)
        proposal = self._read_proposal(proposal_id)
        community = self._read_community(community_id)

        proposal["base_score"] = base_score
        proposal["pulse_bonus"] = pulse_bonus
        proposal["total_score"] = total_score
        proposal["principle_scores"] = principle_scores
        proposal["recommendation"] = recommendation
        proposal["reasoning"] = reasoning
        proposal["concerns"] = concerns

        funding_threshold = community["funding_threshold"]

        if total_score >= funding_threshold:
            proposal["status"] = "funded"
            community["pot_balance"] = community["pot_balance"] - proposal["amount"]
            community["funded_count"] = community["funded_count"] + 1
            community["total_funded"] = community["total_funded"] + proposal["amount"]
            if community["pot_balance"] <= 0:
                community["status"] = "depleted"
        elif total_score >= 50:
            proposal["status"] = "revision"
        else:
            proposal["status"] = "rejected"

        self._write_proposal(proposal_id, proposal)
        self._write_community(community_id, community)

    @gl.public.write
    def revise_proposal(
        self,
        original_proposal_id: str,
        proposer_address: str,
        title: str,
        amount: str,
        what_it_does: str,
        who_it_helps: str,
        success_metric: str,
        timeline: str
    ) -> str:
        original = self._read_proposal(original_proposal_id)

        if original["proposer"] != proposer_address:
            return ""

        if original["status"] != "revision":
            return ""

        if original["revision_count"] != 0:
            return ""

        community_id = original["community_id"]
        community = self._read_community(community_id)

        fee = community["proposal_fee"]
        if community["pot_balance"] < fee:
            return ""

        amt = int(amount)
        max_allowed = (community["pot_balance"] * community["max_proposal_pct"]) // 100
        if amt > max_allowed:
            return ""

        original["revision_count"] = 1
        self._write_proposal(original_proposal_id, original)

        community["pot_balance"] = community["pot_balance"] - fee
        community["proposal_count"] = community["proposal_count"] + 1
        self._write_community(community_id, community)

        proposal_id = self._make_proposal_id()

        proposal = {
            "id": proposal_id,
            "community_id": community_id,
            "proposer": proposer_address,
            "proposer_name": original["proposer_name"],
            "title": title,
            "amount": amt,
            "what_it_does": what_it_does,
            "who_it_helps": who_it_helps,
            "success_metric": success_metric,
            "timeline": timeline,
            "status": "pending",
            "is_revision": True,
            "original_proposal_id": original_proposal_id,
            "pulse_count": 0,
            "pulse_bonus": 0,
            "base_score": None,
            "total_score": None,
            "principle_scores": {
                "purpose_alignment": None,
                "community_benefit": None,
                "constitutional_fit": None,
                "feasibility": None,
                "value_for_money": None,
            },
            "recommendation": None,
            "reasoning": None,
            "concerns": None,
            "revision_count": 0,
            "created_at": int(self.proposal_count),
        }

        self._write_proposal(proposal_id, proposal)
        self._set_proposal_pulses(proposal_id, [])

        community_props = self._get_community_proposals(community_id)
        community_props.append(proposal_id)
        self._set_community_proposals(community_id, community_props)

        member_props = self._get_member_proposals(proposer_address)
        member_props.append(proposal_id)
        self._set_member_proposals(proposer_address, member_props)

        return proposal_id

    @gl.public.write
    def finalize_game(self, community_id: str) -> None:
        pass

    # ----------------------------------------------------------------
    # Public view methods — unchanged from V1
    # ----------------------------------------------------------------

    @gl.public.view
    def get_community(self, community_id: str) -> str:
        if community_id not in self.communities:
            return json.dumps({"error": "Community not found"})
        return self.communities[community_id]

    @gl.public.view
    def get_proposal(self, proposal_id: str) -> str:
        if proposal_id not in self.proposals:
            return json.dumps({"error": "Proposal not found"})
        return self.proposals[proposal_id]

    @gl.public.view
    def get_community_proposals(self, community_id: str) -> str:
        ids = self._get_community_proposals(community_id)
        result = []
        for pid in ids:
            raw = self.proposals.get(pid)
            if raw is not None:
                result.append(json.loads(raw))
        return json.dumps(result)

    @gl.public.view
    def get_funded_proposals(self, community_id: str) -> str:
        ids = self._get_community_proposals(community_id)
        result = []
        for pid in ids:
            raw = self.proposals.get(pid)
            if raw is not None:
                p = json.loads(raw)
                if p["status"] == "funded":
                    result.append(p)
        return json.dumps(result)

    @gl.public.view
    def get_my_proposals(self, address: str) -> str:
        ids = self._get_member_proposals(address)
        result = []
        for pid in ids:
            raw = self.proposals.get(pid)
            if raw is not None:
                result.append(json.loads(raw))
        return json.dumps(result)

    @gl.public.view
    def get_community_members(self, community_id: str) -> str:
        members = self._get_community_members(community_id)
        return json.dumps(members)

    @gl.public.view
    def get_recent_communities(self, limit: int) -> str:
        result = []
        total = int(self.community_count)
        # Walk backwards from highest ID to get most recent
        for n in range(total, 0, -1):
            if len(result) >= limit:
                break
            community_id = "COM" + str(n).zfill(6)
            raw = self.communities.get(community_id)
            if raw is not None:
                result.append(json.loads(raw))
        return json.dumps(result)
