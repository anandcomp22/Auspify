const bcrypt = require('bcryptjs');
const db = require('./init');

function seed() {
  console.log('[Seed] Beginning LMS database seeding with realistic engineering curriculum...');

  // Check if users already seeded
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers && existingUsers.count > 0) {
    console.log('[Seed] Database already seeded. Skipping initial population.');
    return;
  }

  // Password hashes
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('AdminPassword123!', salt);
  const instructorPass = bcrypt.hashSync('InstructorPass123!', salt);
  const studentPass = bcrypt.hashSync('StudentPass123!', salt);

  // 1. Insert Users
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, headline, bio, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const adminId = insertUser.run(
    'admin@auspify.edu',
    adminPass,
    'Dr. Helen Vance',
    'admin',
    'Director of Academic Infrastructure & Computing Systems',
    'Oversees campus-wide engineering curriculum platforms, accreditation standards, and system security.',
    '/img/avatars/admin.jpg'
  ).lastInsertRowid;

  const profThorneId = insertUser.run(
    'thorne@auspify.edu',
    instructorPass,
    'Prof. Marcus Thorne',
    'instructor',
    'Principal Research Scientist, Distributed Systems Laboratory',
    'Specializes in consensus protocols, Byzantine fault tolerance, and high-throughput log-structured storage engines. Former research fellow at Bell Labs.',
    '/img/avatars/thorne.jpg'
  ).lastInsertRowid;

  const drRostovaId = insertUser.run(
    'rostova@auspify.edu',
    instructorPass,
    'Dr. Elena Rostova',
    'instructor',
    'Associate Professor of Compiler Engineering & Program Analysis',
    'Specializes in SSA-form intermediate representations, static verification, and just-in-time machine code optimization.',
    '/img/avatars/rostova.jpg'
  ).lastInsertRowid;

  const studentJulianId = insertUser.run(
    'student@auspify.edu',
    studentPass,
    'Julian Reed',
    'student',
    'Systems Engineering Undergraduate, Senior Year',
    'Pursuing research in high-performance network protocols and distributed storage. Maintaining 3.9 GPA.',
    '/img/avatars/julian.jpg'
  ).lastInsertRowid;

  const studentChenId = insertUser.run(
    'schen@auspify.edu',
    studentPass,
    'Sarah Chen',
    'student',
    'Computer Science Undergraduate, Junior Year',
    'Focusing on compiler construction, formal semantics, and operating systems development.',
    '/img/avatars/sarah.jpg'
  ).lastInsertRowid;

  console.log('[Seed] Inserted 5 core users (Admin, 2 Instructors, 2 Students).');

  // 2. Insert Courses
  const insertCourse = db.prepare(`
    INSERT INTO courses (code, slug, title, subtitle, description, category, difficulty, estimated_hours, instructor_id, status, syllabus_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Course 1: CS-401
  const course1Syllabus = JSON.stringify([
    'Module 1: Clocks, Asynchrony, and Vector Timestamps',
    'Module 2: Quorum Systems and Raft Consensus Protocol',
    'Module 3: Log Replication, State Machines, and Commit Indexes',
    'Module 4: Linearizable Key-Value Engines and LSM-Trees'
  ]);

  const course1Id = insertCourse.run(
    'CS-401',
    'distributed-systems-architecture',
    'Distributed Systems Architecture',
    'Fault-Tolerant Consensus, Log-Structured Storage, and Network Partitions',
    'A rigorous, hands-on study of distributed systems design. Students explore mathematical foundations of consensus, master the Raft protocol, handle partial network failures, and build linearizable fault-tolerant services.',
    'Systems Engineering',
    'Advanced',
    36,
    profThorneId,
    'published',
    course1Syllabus
  ).lastInsertRowid;

  // Course 2: CS-302
  const course2Syllabus = JSON.stringify([
    'Module 1: Lexical Scanners and Recursive Descent AST Parsing',
    'Module 2: Static Single Assignment (SSA) and Symbol Tables',
    'Module 3: Dataflow Analysis, Constant Folding, and Inlining',
    'Module 4: x86-64 Machine Code Generation and Register Allocation'
  ]);

  const course2Id = insertCourse.run(
    'CS-302',
    'compiler-construction-and-code-generation',
    'Compiler Construction and Code Generation',
    'Lexical Scanners, Abstract Syntax Trees, and SSA Optimization',
    'An architectural deep dive into compiling high-level programming languages into high-efficiency native code. Covers recursive descent parsing, symbol tables, type validation, SSA optimization, and x86-64 register allocation.',
    'Programming Languages',
    'Advanced',
    30,
    drRostovaId,
    'published',
    course2Syllabus
  ).lastInsertRowid;

  // Course 3: CS-205
  const course3Syllabus = JSON.stringify([
    'Module 1: Authenticated Encryption and Block Cipher Modes',
    'Module 2: Elliptic Curve Cryptography and Digital Signatures',
    'Module 3: TLS 1.3 Protocol Handshakes and Zero-RTT Resumption',
    'Module 4: Public Key Infrastructure and Formal Key Exchange'
  ]);

  const course3Id = insertCourse.run(
    'CS-205',
    'cryptographic-protocols-and-network-security',
    'Cryptographic Protocols and Network Security',
    'Applied Cryptography, Zero-Knowledge Proofs, and TLS 1.3 Internals',
    'Explores symmetric ciphers, authenticated key exchange, elliptic-curve cryptography, and modern transport layer security. Emphasizes side-channel attack mitigations and cryptographic correctness.',
    'Information Security',
    'Intermediate',
    24,
    profThorneId,
    'published',
    course3Syllabus
  ).lastInsertRowid;

  console.log('[Seed] Inserted 3 flagship engineering courses.');

  // 3. Insert Modules and Lessons
  const insertModule = db.prepare(`
    INSERT INTO course_modules (course_id, title, description, order_index)
    VALUES (?, ?, ?, ?)
  `);

  const insertLesson = db.prepare(`
    INSERT INTO lessons (course_id, module_id, title, slug, content_type, content, video_url, duration_mins, order_index, resources_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Course 1 Modules & Lessons
  const c1m1 = insertModule.run(
    course1Id,
    'Foundations of Distributed State and Clocks',
    'Explores physical time limits, network latency variations, and logical clock invariants.',
    1
  ).lastInsertRowid;

  const c1m2 = insertModule.run(
    course1Id,
    'The Raft Consensus Algorithm',
    'Leader election, log consistency checks, committed entries, and split-brain resolution.',
    2
  ).lastInsertRowid;

  const c1m3 = insertModule.run(
    course1Id,
    'Storage Engines & Linearizable Semantics',
    'Write-ahead logs, log-structured merge trees, and linearizable read-write boundaries.',
    3
  ).lastInsertRowid;

  // Course 1 Lessons
  const c1l1 = insertLesson.run(
    course1Id,
    c1m1,
    'Physical Clocks, NTP Drift, and Network Asynchrony',
    'physical-clocks-and-asynchrony',
    'article',
    `# Physical Clocks, NTP Drift, and Network Asynchrony

In distributed systems, physical time cannot be trusted to establish global order across independent nodes. Quartz oscillator drift, network packet transmission delays, and virtual machine pauses render wall-clock timestamps unsuitable for strict linearizability.

## The Physical Clock Problem

Every machine possesses an internal crystal oscillator that ticks at an imperfect frequency. This causes clock drift relative to International Atomic Time (TAI):
* Standard server crystals drift by up to 10 to 50 parts per million (ppm).
* Over a 24-hour window without synchronization, two uncalibrated servers can diverge by more than a full second.
* Network Time Protocol (NTP) attempts correction over UDP, but network jitter imposes unpredictable uncertainty bounds:

\`\`\`
error_bound = (round_trip_delay / 2) + local_drift_offset
\`\`\`

## Key Asynchrony Invariants

In an asynchronous network model:
1. Message transmission delay is finite but strictly unbounded.
2. Clock drift rates are bounded, but the absolute skew across nodes cannot be guaranteed without hardware atomic clocks (such as Google TrueTime).
3. Process execution speeds are arbitrary, meaning a node cannot distinguish between a crashed peer and a slow peer responding over a delayed network route.

## Operational Takeaways
Do not use wall-clock timestamps to order database transactions or decide leader lease validity unless working with certified hardware time APIs. Instead, systems must rely on logical clocks and state-machine replication protocols.`,
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    20,
    1,
    JSON.stringify([
      { name: 'Paper: Time, Clocks, and the Ordering of Events (Lamport 1978)', url: 'https://lamport.azurewebsites.net/pubs/time-clocks.pdf' }
    ])
  ).lastInsertRowid;

  const c1l2 = insertLesson.run(
    course1Id,
    c1m1,
    'Logical Time, Lamport Timestamps, and Vector Clocks',
    'logical-time-and-vector-clocks',
    'article',
    `# Logical Time, Lamport Timestamps, and Vector Clocks

To order events across distributed nodes without hardware clock synchronization, we define causality using logical time. Leslie Lamport introduced the *happened-before* relation, formalized as:

\`\`\`
a -> b
\`\`\`

## Lamport Clock Rules

Each process maintains an integer counter \`L\`:
1. Before executing an internal event, increment local counter: \`L = L + 1\`.
2. When transmitting a message, attach the current counter value \`L\`.
3. Upon receiving a message with timestamp \`T\`, the receiver updates its local counter:

\`\`\`
L_receiver = max(L_receiver, T) + 1
\`\`\`

While Lamport timestamps provide a total order by tie-breaking on process IDs, they cannot detect concurrency. If \`L(a) < L(b)\`, event \`a\` did not necessarily cause event \`b\`.

## Vector Clocks for Causal Detection

A vector clock maintains an array of counters \`V\` of size \`N\`, where \`N\` is the number of participating nodes:
* \`V_i[i]\` represents node \`i\`'s local event counter.
* \`V_i[j]\` represents node \`i\`'s latest known progress of node \`j\`.

Two events are concurrent (\`a || b\`) if and only if neither vector strictly dominates the other:

\`\`\`
not(V(a) <= V(b)) AND not(V(b) <= V(a))
\`\`\`

This provides the exact mathematical foundation used in distributed versioning and conflict resolution.`,
    null,
    25,
    2,
    JSON.stringify([
      { name: 'Vector Clocks Implementation Guide', url: '#' }
    ])
  ).lastInsertRowid;

  const c1l3 = insertLesson.run(
    course1Id,
    c1m2,
    'Raft Leader Election and Heartbeat Semantics',
    'raft-leader-election-and-heartbeats',
    'article',
    `# Raft Leader Election and Heartbeat Semantics

Raft decomposes distributed consensus into three independent subproblems:
1. Leader Election
2. Log Replication
3. State Safety Invariants

## State Transitions

At any given moment, each Raft node is in one of three states:
* **Follower**: Passive, accepts log entries and heartbeats from a recognized leader.
* **Candidate**: Actively requesting votes after an election timeout expires.
* **Leader**: Handles all client read-write operations and sends periodic append entries heartbeats.

\`\`\`
[ Follower ] --(election timeout)--> [ Candidate ]
     ^                                     |
     |                                     v (receives majority votes)
     +---------(discovers higher term)----+ [ Leader ]
\`\`\`

## Randomized Election Timeouts

To prevent split votes when multiple followers timeout simultaneously, Raft employs randomized election timeouts (typically 150ms to 300ms). The first candidate to wake up broadcasts a \`RequestVote\` RPC:

\`\`\`json
{
  "term": 4,
  "candidateId": 2,
  "lastLogIndex": 84,
  "lastLogTerm": 3
}
\`\`\`

A peer grants its vote if and only if:
1. The candidate's term is greater than or equal to the receiver's term.
2. The receiver has not yet voted for another candidate in this term.
3. The candidate's log is at least as up-to-date as the receiver's log (comparing \`lastLogTerm\` first, then \`lastLogIndex\`).`,
    null,
    30,
    1,
    JSON.stringify([
      { name: 'In Search of an Understandable Consensus Algorithm (Ongaro & Ousterhout)', url: 'https://raft.github.io/raft.pdf' }
    ])
  ).lastInsertRowid;

  const c1l4 = insertLesson.run(
    course1Id,
    c1m2,
    'Log Replication, Safety Invariants, and Commit Indexes',
    'log-replication-and-commit-indexes',
    'article',
    `# Log Replication, Safety Invariants, and Commit Indexes

Once a leader is elected, it coordinates all write operations across the cluster to guarantee linearizability and fault tolerance.

## The Replication Flow

1. Client submits a command to the Leader.
2. Leader appends the command to its local write-ahead log as an uncommitted entry.
3. Leader broadcasts an \`AppendEntries\` RPC to all followers.
4. Once a majority of followers acknowledge writing the entry to durable disk, the leader increments its \`commitIndex\`.
5. Leader applies the entry to its local state machine and returns success to the client.
6. The updated \`commitIndex\` is transmitted to followers in subsequent heartbeats.

\`\`\`
Client ---> Leader [Append to Log] ---> Followers [Append to Disk]
               |                               |
               v                               v
           Majority Ack Received? ---------> Commit Index Updated
               |
               v
       Apply to State Machine & Return
\`\`\`

## The Log Matching Invariant

Raft enforces strict safety invariants:
* If two log entries in different logs have the same index and term, they store the identical command.
* If two entries in different logs have the same index and term, then their logs are identical in all preceding entries.

When a follower's log diverges following a partition, the leader forces the follower to overwrite conflicting entries with the leader's authoritative log stream.`,
    null,
    35,
    2,
    null
  ).lastInsertRowid;

  const c1l5 = insertLesson.run(
    course1Id,
    c1m3,
    'Log-Structured Merge-Trees and Write-Ahead Logging',
    'lsm-trees-and-write-ahead-logging',
    'article',
    `# Log-Structured Merge-Trees and Write-Ahead Logging

Traditional B-Trees incur severe write amplification and random disk I/O when processing heavy write workloads. Log-Structured Merge-Trees (LSM-Trees) transform random disk writes into high-speed sequential appends.

## Architectural Components

1. **Write-Ahead Log (WAL)**: An append-only file on disk that provides immediate durability before memory changes.
2. **MemTable**: An in-memory concurrent skip-list or balanced search tree that buffers active writes in sorted key order.
3. **SSTables (Sorted String Tables)**: Immutable disk files organized in hierarchical levels (Level 0 through Level N). Each file contains sorted key-value pairs, a Bloom filter, and an index block.

\`\`\`
Writes ---> [ Write-Ahead Log (Disk) ]
       ---> [ MemTable (RAM) ]
                  | (when full, flush)
                  v
            [ L0 SSTable ]
                  | (compaction)
                  v
            [ L1 SSTable ] -> [ L2 SSTable ]
\`\`\`

## Compaction Mechanics

As background threads run, older SSTables are merged and sorted through leveled or size-tiered compaction. Deleted keys (marked with tombstones) and obsolete versions are purged, reclaiming disk space and bounding read latency.`,
    null,
    30,
    1,
    null
  ).lastInsertRowid;

  // Course 2 Modules & Lessons
  const c2m1 = insertModule.run(
    course2Id,
    'Front-End Syntactic Analysis and Scanners',
    'Grammars, lexical tokens, precedence parsing, and AST construction.',
    1
  ).lastInsertRowid;

  const c2l1 = insertLesson.run(
    course2Id,
    c2m1,
    'Lexical Scanning, Regular Grammars, and Token Streams',
    'lexical-scanning-and-token-streams',
    'article',
    `# Lexical Scanning, Regular Grammars, and Token Streams

The front-end of a modern compiler converts raw source characters into a stream of typed tokens. This process strips whitespace, discards comments, and validates literal structures.

## Finite State Automata

Each token rule corresponds to a regular expression converted into a Deterministic Finite Automaton (DFA):
* **Maximal Munch Rule**: When multiple token rules match, the scanner consumes the longest possible character sequence.
* **Keyword Priority**: Fixed keywords (such as \`fn\`, \`let\`, \`return\`) are matched before generic identifier rules.

\`\`\`c
typedef enum {
    TOKEN_KW_LET,
    TOKEN_IDENTIFIER,
    TOKEN_EQUALS,
    TOKEN_INT_LITERAL,
    TOKEN_SEMICOLON,
    TOKEN_EOF
} TokenType;
\`\`\`

By separating scanning from parsing, we simplify the parser grammar and improve compiler throughput.`,
    null,
    20,
    1,
    null
  ).lastInsertRowid;

  const c2l2 = insertLesson.run(
    course2Id,
    c2m1,
    'Abstract Syntax Tree Construction and Type Inference',
    'ast-construction-and-type-inference',
    'article',
    `# Abstract Syntax Tree Construction and Type Inference

Once tokens are recognized, a recursive descent parser builds the Abstract Syntax Tree (AST). The AST represents the nested syntactic structure of the program without concrete grammar artifacts like parentheses and semicolons.

## AST Node Representation

In an intermediate representation, expression nodes retain source locations, evaluated type metadata, and recursive child references:

\`\`\`rust
pub enum Expr {
    Binary {
        op: BinaryOp,
        lhs: Box<Expr>,
        rhs: Box<Expr>,
        ty: Type,
    },
    Variable {
        name: String,
        ty: Type,
    },
    Literal(LiteralValue),
}
\`\`\`

Type checking traverses the tree in post-order, verifying that operand types match expected signatures and reporting clear, precise compiler diagnostics.`,
    null,
    25,
    2,
    null
  ).lastInsertRowid;

  // Course 3 Modules & Lessons
  const c3m1 = insertModule.run(
    course3Id,
    'Symmetric Ciphers and Authenticated Encryption',
    'Block ciphers, counter mode, Galois authentication, and forward secrecy.',
    1
  ).lastInsertRowid;

  const c3l1 = insertLesson.run(
    course3Id,
    c3m1,
    'AES-GCM Authenticated Encryption and Nonce Misuse',
    'aes-gcm-and-nonce-misuse',
    'article',
    `# AES-GCM Authenticated Encryption and Nonce Misuse

Authenticated Encryption with Associated Data (AEAD) guarantees both confidentiality and authenticity in a single cryptographic primitive. AES in Galois/Counter Mode (AES-GCM) is the industry standard for modern secure protocols.

## The Catastrophic Nonce Reuse Vulnerability

AES-GCM combines CTR mode encryption with GHASH polynomial evaluation over GF(2^128). 

**Critical Rule**: A 96-bit initialization vector (nonce) must NEVER be repeated under the same 256-bit key.
* Reusing a nonce reveals the XOR sum of two plaintexts: \`C1 ^ C2 = P1 ^ P2\`.
* Repeating a nonce allows an attacker to compute the GHASH authentication key \`H\`, enabling undetectable forgery of arbitrary messages.

\`\`\`
Plaintext P1 ---> XOR (Keystream) ---> Ciphertext C1
                                           |
                                           v
                              GHASH(H, C1, AD) ---> Tag T1
\`\`\`

Always use unique cryptographic counters or random nonces generated from verified CSPRNGs.`,
    null,
    20,
    1,
    null
  ).lastInsertRowid;

  console.log('[Seed] Inserted modules and lessons with comprehensive technical copy.');

  // 4. Insert Quizzes and Questions
  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (course_id, module_id, title, description, time_limit_mins, passing_score, max_attempts, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertQuestion = db.prepare(`
    INSERT INTO quiz_questions (quiz_id, question_text, code_snippet, explanation, points, order_index, options_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Course 1 Quiz 1
  const q1Id = insertQuiz.run(
    course1Id,
    c1m1,
    'CS-401 Foundations Examination: Clocks & Causality',
    'Formal assessment covering physical clock drift bounds, Lamport timestamp orderings, and vector clock concurrency detection.',
    20,
    75,
    3,
    'published'
  ).lastInsertRowid;

  insertQuestion.run(
    q1Id,
    'Why is Network Time Protocol (NTP) insufficient to guarantee linearizable transaction order in high-throughput distributed databases?',
    null,
    'NTP cannot eliminate non-deterministic network transit delays and crystal oscillator drift without hardware atomic clock synchronization, leaving a window of uncertainty where two independent nodes can produce contradictory chronological timestamps.',
    10,
    1,
    JSON.stringify([
      { id: 'a', text: 'NTP only works over TCP connections which introduce blocking overhead', is_correct: false },
      { id: 'b', text: 'Network jitter and oscillator drift create an unavoidable window of uncertainty that can misorder causally related events', is_correct: true },
      { id: 'c', text: 'NTP timestamps roll over every 32 bits, making long-term storage verification impossible', is_correct: false },
      { id: 'd', text: 'NTP requires all machines to share the same physical motherboard bus', is_correct: false }
    ])
  );

  insertQuestion.run(
    q1Id,
    'Given two events with vector timestamps Va = [2, 1, 4] and Vb = [3, 1, 2], what is their causal relationship?',
    'Va = [2, 1, 4]\nVb = [3, 1, 2]',
    'Event a has a larger component at index 2 (4 > 2), while event b has a larger component at index 0 (3 > 2). Neither vector dominates the other, so the events are concurrent (Va || Vb).',
    10,
    2,
    JSON.stringify([
      { id: 'a', text: 'Event a strictly caused event b (Va -> Vb)', is_correct: false },
      { id: 'b', text: 'Event b strictly caused event a (Vb -> Va)', is_correct: false },
      { id: 'c', text: 'The events are concurrent (Va || Vb) and cannot be causally ordered', is_correct: true },
      { id: 'd', text: 'The timestamps indicate an illegal state partition', is_correct: false }
    ])
  );

  insertQuestion.run(
    q1Id,
    'In the Raft consensus algorithm, under what condition does a follower grant its vote to a candidate in a given election term?',
    null,
    'A follower only votes for a candidate whose log is at least as up to date as its own (evaluating lastLogTerm first, then lastLogIndex), and if the follower has not already voted in that term.',
    10,
    3,
    JSON.stringify([
      { id: 'a', text: 'Only if the candidate has the lowest node ID number in the cluster', is_correct: false },
      { id: 'b', text: 'Only if the candidate has not rebooted in the last hour', is_correct: false },
      { id: 'c', text: 'If the candidate log is at least as up-to-date as the receiver log, and the receiver has not already voted in that term', is_correct: true },
      { id: 'd', text: 'Whenever any candidate requests a vote with a higher network IP address', is_correct: false }
    ])
  );

  insertQuestion.run(
    q1Id,
    'What primary advantage does an LSM-Tree offer over a traditional B-Tree under write-heavy workloads?',
    null,
    'LSM-Trees buffer incoming writes in memory and sequentially flush them to disk as immutable sorted tables, completely replacing expensive random disk writes with efficient sequential I/O.',
    10,
    4,
    JSON.stringify([
      { id: 'a', text: 'It completely eliminates the need for a Write-Ahead Log (WAL)', is_correct: false },
      { id: 'b', text: 'It transforms random disk writes into high-speed sequential writes by buffering in a MemTable and flushing immutable SSTables', is_correct: true },
      { id: 'c', text: 'It guarantees that reads never check more than a single block', is_correct: false },
      { id: 'd', text: 'It uses 90% less RAM than a hash table index', is_correct: false }
    ])
  );

  // Course 2 Quiz 1
  const q2Id = insertQuiz.run(
    course2Id,
    c2m1,
    'CS-302 Syntactic Parsing and AST Construction Examination',
    'Evaluates lexical DFA construction, grammar disambiguation, and AST post-order type evaluation.',
    20,
    70,
    3,
    'published'
  ).lastInsertRowid;

  insertQuestion.run(
    q2Id,
    'What does the "Maximal Munch" rule dictate in lexical scanners?',
    null,
    'The scanner consumes the longest valid character sequence that matches any recognized token pattern before producing a token.',
    10,
    1,
    JSON.stringify([
      { id: 'a', text: 'The parser discards all tokens that exceed 64 bytes in length', is_correct: false },
      { id: 'b', text: 'The scanner always consumes the longest sequence of characters that can form a valid token', is_correct: true },
      { id: 'c', text: 'The compiler prioritizes whitespace over alphanumeric characters', is_correct: false },
      { id: 'd', text: 'Memory allocation for tokens is executed in 4KB bulk pages', is_correct: false }
    ])
  );

  insertQuestion.run(
    q2Id,
    'In Static Single Assignment (SSA) form, what is the role of a phi function?',
    null,
    'Phi functions merge multiple conflicting versions of a variable originating from diverging control flow branches at a join node.',
    10,
    2,
    JSON.stringify([
      { id: 'a', text: 'It converts floating-point numbers into fixed-point representations', is_correct: false },
      { id: 'b', text: 'It selects an incoming variable version depending on which control-flow branch executed prior to the block join', is_correct: true },
      { id: 'c', text: 'It allocates an x86-64 register on the stack', is_correct: false },
      { id: 'd', text: 'It handles tail-call recursion optimization', is_correct: false }
    ])
  );

  console.log('[Seed] Inserted quizzes and comprehensive question banks.');

  // 5. Insert Assignments
  const insertAssignment = db.prepare(`
    INSERT INTO assignments (course_id, module_id, title, description, instructions, max_points, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const a1Id = insertAssignment.run(
    course1Id,
    c1m2,
    'Lab Project 1: Raft Consensus State Machine Engine',
    'Implement the core leader election and log replication mechanisms of the Raft consensus algorithm.',
    `### Assignment Instructions

1. **Protocol Implementation**: Construct an in-memory or network-backed Node.js or C++ Raft state machine handling:
   - Heartbeat broadcasting with randomized jitter (150ms to 300ms).
   - Candidate vote tallying and term bumping.
   - AppendEntries RPC validation with log consistency rollbacks.
2. **Safety Invariants**:
   - Verify that committed log entries survive simulated leader crashes.
   - Guarantee that no two nodes commit contradictory log entries at identical indexes.
3. **Deliverables**:
   - Provide your core state machine engine source code.
   - Include automated test suite logs proving clean partition recovery.
   - Submit a technical report documenting performance under 3-node and 5-node cluster configurations.`,
    100,
    '2026-12-15 23:59:59',
    'published'
  ).lastInsertRowid;

  const a2Id = insertAssignment.run(
    course2Id,
    c2m1,
    'Lab 2: Abstract Syntax Tree Type Checker & Symbol Table',
    'Build a robust recursive AST type checker with lexical scope resolution.',
    `### Assignment Instructions

1. Construct a symbol table capable of handling nested lexical scopes (block scopes and function scopes).
2. Implement static type validation for arithmetic expressions, boolean comparisons, and assignment expressions.
3. Ensure descriptive diagnostics with line and column numbers are emitted for undeclared identifiers and type mismatches.`,
    100,
    '2026-12-20 23:59:59',
    'published'
  ).lastInsertRowid;

  console.log('[Seed] Inserted engineering assignments.');

  // 6. Insert Enrollments, Progress, and Completions
  const insertEnrollment = db.prepare(`
    INSERT INTO enrollments (user_id, course_id, status, progress_percent, enrolled_at, completed_at, certificate_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCompletion = db.prepare(`
    INSERT INTO lesson_completions (user_id, course_id, lesson_id, completed_at)
    VALUES (?, ?, ?, ?)
  `);

  // Julian Reed is enrolled in CS-401 (in progress: completed 3 of 5 lessons = 60%)
  insertEnrollment.run(
    studentJulianId,
    course1Id,
    'active',
    60,
    '2026-10-15 09:00:00',
    null,
    null
  );

  insertCompletion.run(studentJulianId, course1Id, c1l1, '2026-10-16 11:20:00');
  insertCompletion.run(studentJulianId, course1Id, c1l2, '2026-10-18 14:45:00');
  insertCompletion.run(studentJulianId, course1Id, c1l3, '2026-10-22 16:30:00');

  // Julian Reed is also enrolled in CS-205 with 100% completion and an issued certificate!
  const certCode = 'AUSPIFY-LMS-2026-88F4A19E';
  insertEnrollment.run(
    studentJulianId,
    course3Id,
    'completed',
    100,
    '2026-09-01 10:00:00',
    '2026-10-10 17:00:00',
    certCode
  );

  insertCompletion.run(studentJulianId, course3Id, c3l1, '2026-10-05 15:00:00');

  // Insert verified certificate for Julian
  const insertCert = db.prepare(`
    INSERT INTO certificates (certificate_code, user_id, course_id, student_name, course_title, course_code, issue_date, verification_hash, grade_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCert.run(
    certCode,
    studentJulianId,
    course3Id,
    'Julian Reed',
    'Cryptographic Protocols and Network Security',
    'CS-205',
    '2026-10-10 17:00:00',
    'sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'Final Grade: 94.5% (High Distinction). All modules, laboratory benchmarks, and security audits verified.'
  );

  // Sarah Chen is enrolled in CS-302
  insertEnrollment.run(
    studentChenId,
    course2Id,
    'active',
    50,
    '2026-10-20 14:00:00',
    null,
    null
  );

  insertCompletion.run(studentChenId, course2Id, c2l1, '2026-10-21 10:15:00');

  // 7. Insert Quiz Attempts
  const insertQuizAttempt = db.prepare(`
    INSERT INTO quiz_attempts (quiz_id, user_id, score, total_points, percentage, passed, answers_json, time_spent_secs, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertQuizAttempt.run(
    q1Id,
    studentJulianId,
    30,
    40,
    75,
    1,
    JSON.stringify({ 1: 'b', 2: 'c', 3: 'c', 4: 'a' }),
    740,
    '2026-10-23 18:30:00'
  );

  // 8. Insert Assignment Submissions
  const insertSubmission = db.prepare(`
    INSERT INTO assignment_submissions (assignment_id, user_id, submission_text, file_name, status, score, feedback, graded_by, submitted_at, graded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSubmission.run(
    a1Id,
    studentJulianId,
    `Raft Consensus State Machine Engine Submission:

We implemented a 5-node cluster protocol using zero-dependency Node.js state machines. The cluster successfully survived dynamic node partitioning:
- Heartbeat interval: 150ms with +/- 50ms random jitter.
- Quorum calculation: (n / 2) + 1 = 3 nodes.
- Test coverage: 14 passing automated integration assertions verifying leader re-election within 350ms of network drop.`,
    'raft_cluster_v1.zip',
    'graded',
    96,
    'Outstanding architectural execution. Clean state machine decoupling and rigorous election jitter mitigation.',
    profThorneId,
    '2026-11-01 14:20:00',
    '2026-11-03 09:15:00'
  );

  console.log('[Seed] Database seeding finished successfully.');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
