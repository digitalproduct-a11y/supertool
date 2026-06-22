// Shape of the live state-assembly results feed
// (data.pru.astroawani.com/data/{season}/result_state_assembly.json).
// Root is a flat array of SeatResult; there is no national/state summary block,
// so all tallies are derived client-side (see electionAggregate.ts).

export type CandidateStatus = "win" | "lose" | null;

export interface Candidate {
  name: string;
  status: CandidateStatus;
  vote: number;
  /** Party / coalition id — look up via getParty() in constants/parties.ts. */
  party: number;
  id: number;
}

export interface ParliamentRef {
  seat: string;
  name: string;
}

export interface SeatResult {
  state: string;
  season_id: number;
  state_id: number;
  seat_id: string;
  seat_name: string;
  is_heavyweight: 0 | 1;
  registered_voters: number;
  rejected_votes: number;
  official_result: boolean;
  last_published_at: string;
  majority: number;
  candidates: Candidate[];
  parliament: ParliamentRef;
}
