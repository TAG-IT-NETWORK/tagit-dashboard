// GraphQL queries for tagit-indexer subgraph (agent activity + wTAG distribution)

// ─── Agent Activity Queries ─────────────────────────────────────────────

export const AGENT_STATUS_CHANGES_QUERY = `
  query AgentStatusChanges($first: Int!, $skip: Int!) {
    agentStatusChanges(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      agent {
        id
        agentId
        wallet
        statusLabel
      }
      oldStatus
      newStatus
      oldStatusLabel
      newStatusLabel
      timestamp
      blockNumber
      transactionHash
    }
  }
`;

export const AGENT_FEEDBACKS_QUERY = `
  query AgentFeedbacks($first: Int!, $skip: Int!) {
    feedbacks(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      feedbackId
      agent {
        id
        agentId
        wallet
      }
      reviewer
      rating
      revoked
      hasResponse
      createdAt
      createdAtBlock
    }
  }
`;

export const AGENT_VALIDATIONS_QUERY = `
  query AgentValidations($first: Int!, $skip: Int!) {
    validationRequests(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      requestId
      agent {
        id
        agentId
        wallet
      }
      requester
      isDefense
      status
      responseCount
      passed
      finalScore
      createdAt
      createdAtBlock
      finalizedAt
    }
  }
`;

export const REWARD_DISTRIBUTIONS_QUERY = `
  query RewardDistributions($first: Int!, $skip: Int!) {
    rewardDistributions(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      recipientAddress
      amount
      triggerType
      triggerTypeLabel
      cumulativeDistributed
      blockNumber
      timestamp
      transactionHash
    }
  }
`;

// ─── wTAG Distribution Queries ──────────────────────────────────────────

export const WTAG_HOLDERS_QUERY = `
  query WTagHolders($first: Int!, $skip: Int!, $minBalance: BigInt!) {
    wtagAccounts(
      first: $first
      skip: $skip
      orderBy: balance
      orderDirection: desc
      where: { balance_gt: $minBalance }
    ) {
      id
      address
      balance
      transfersSent
      transfersReceived
    }
  }
`;

export const WTAG_TRANSFERS_QUERY = `
  query WTagTransfers($first: Int!, $skip: Int!) {
    wtagTransfers(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      from {
        id
        address
      }
      to {
        id
        address
      }
      value
      timestamp
      blockNumber
      transactionHash
    }
  }
`;

export const PROTOCOL_STATS_QUERY = `
  query ProtocolStats {
    protocol(id: "1") {
      id
      totalAgents
      totalActiveAgents
      totalFeedback
      totalActiveFeedback
      totalRatingSum
      averageRating
      totalValidationRequests
      totalValidationsPassed
      totalValidationsFailed
      wtagTotalSupply
      wtagTotalTransfers
      wtagTotalBurned
      totalEscrows
      totalEscrowsReleased
      totalEscrowsCancelled
      totalEscrowVolume
    }
  }
`;
