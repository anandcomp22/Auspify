const bcrypt = require('bcryptjs');
const db = require('./init');

function seedDatabase() {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existingAdmin) {
    // Database already seeded
    return;
  }

  console.log('Seeding initial database records...');

  const saltRounds = 10;
  const adminPasswordHash = bcrypt.hashSync('admin123', saltRounds);
  const userPasswordHash = bcrypt.hashSync('seeker123', saltRounds);
  const employerPasswordHash = bcrypt.hashSync('employer123', saltRounds);

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, company, title, bio, skills, location, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Admin
  insertUser.run(
    'admin@jobportal.com',
    adminPasswordHash,
    'Platform Administrator',
    'admin',
    'HireScope Systems',
    'System Administrator',
    'Overseeing network integrity, compliance, and user safety on the HireScope platform.',
    'Administration, Compliance, Infrastructure',
    'San Francisco, CA',
    '+1 (415) 890-1200'
  );

  // 2. Employers
  const emp1 = insertUser.run(
    'elena@strataworks.io',
    employerPasswordHash,
    'Elena Vance',
    'employer',
    'Strata Works',
    'Head of Technical Talent',
    'Strata Works designs high-throughput distributed systems and data storage infrastructure for enterprise teams.',
    'Technical Hiring, Systems Engineering, Organizational Architecture',
    'Denver, CO',
    '+1 (303) 555-0192'
  );

  const emp2 = insertUser.run(
    'marcus@monolith-labs.com',
    employerPasswordHash,
    'Marcus Brody',
    'employer',
    'Monolith Design Labs',
    'Design Partner',
    'Monolith is an architectural software and digital design practice focusing on precision spatial interfaces.',
    'Design Direction, Design Systems, Spatial Computing',
    'San Francisco, CA',
    '+1 (415) 555-0144'
  );

  const emp3 = insertUser.run(
    'nadia@kineticdata.co',
    employerPasswordHash,
    'Nadia Chen',
    'employer',
    'Kinetic Data',
    'VP of Engineering',
    'Building low-latency stream processing pipelines and distributed event topologies for modern robotics.',
    'Engineering Leadership, Streaming Systems, Distributed Topologies',
    'New York, NY',
    '+1 (212) 555-0178'
  );

  // 3. Seekers
  const seeker1 = insertUser.run(
    'alex@example.com',
    userPasswordHash,
    'Alex Mercer',
    'seeker',
    null,
    'Senior Distributed Systems Engineer',
    'Systems software engineer with 7 years of background in Go, Rust, and high-concurrency event loops.',
    'Go, Rust, Docker, Kubernetes, SQLite, PostgreSQL, gRPC, Distributed Systems',
    'Seattle, WA',
    '+1 (206) 555-0133'
  );

  const seeker2 = insertUser.run(
    'devon@example.com',
    userPasswordHash,
    'Devon Zhao',
    'seeker',
    null,
    'Design Systems Architect',
    'Product designer focusing on mathematical typography scales, design tokens, and systematic component libraries.',
    'Figma, Design Tokens, CSS Architecture, TypeScript, Web Components, Accessibility',
    'New York, NY',
    '+1 (917) 555-0182'
  );

  // 4. Jobs
  const insertJob = db.prepare(`
    INSERT INTO jobs (
      employer_id, title, company, location, work_type, job_type,
      salary_min, salary_max, currency, description, requirements,
      skills, experience_level, status, applications_count
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const job1 = insertJob.run(
    emp1.lastInsertRowid,
    'Senior Distributed Systems Engineer',
    'Strata Works',
    'Remote',
    'remote',
    'full-time',
    165000,
    215000,
    'USD',
    'We are seeking an engineer to own our consensus layer and multi-region replication fabric. In this role, you will design deterministic state machine replication, optimize socket throughput under packet jitter, and ensure continuous availability across node failures.',
    'Minimum 5 years building production backend systems in Go, Rust, or modern C++. Deep understanding of Raft or Paxos consensus implementations, memory layout optimization, and network socket programming.',
    'Go, Rust, Distributed Systems, Raft, Networking, Linux Perf',
    'senior',
    'active',
    1
  );

  const job2 = insertJob.run(
    emp2.lastInsertRowid,
    'Staff Frontend Architect',
    'Monolith Design Labs',
    'San Francisco, CA',
    'hybrid',
    'full-time',
    175000,
    225000,
    'USD',
    'Lead the technical architecture of our flagship CAD workspace in the browser. You will build high-frequency rendering pipelines, manage complex local state, and collaborate directly with our industrial design leads to establish unprecedented interface responsiveness.',
    'Proven track record leading complex web application frontends. Mastery of modern browser rendering pipelines, WebGL / Canvas primitives, strict TypeScript, and modular design system implementation.',
    'TypeScript, WebGL, Canvas, Design Systems, State Machines, CSS',
    'lead',
    'active',
    1
  );

  const job3 = insertJob.run(
    emp3.lastInsertRowid,
    'Streaming Data Platform Engineer',
    'Kinetic Data',
    'New York, NY',
    'hybrid',
    'full-time',
    155000,
    195000,
    'USD',
    'Kinetic Data processes 14 million telemetry points every second. We need a Platform Engineer to expand our Apache Kafka and Flink topologies, manage cluster health, and build internal APIs that expose real-time time-series queries to engineering teams.',
    'Experience operating large-scale stream processing workloads (Kafka, Flink, or Redpanda). Familiarity with schema registries, avro serialization, and partition rebalancing strategies.',
    'Kafka, Flink, Java, Python, Kubernetes, Time-Series Databases',
    'mid',
    'active',
    0
  );

  const job4 = insertJob.run(
    emp2.lastInsertRowid,
    'Lead Product Designer',
    'Monolith Design Labs',
    'San Francisco, CA',
    'onsite',
    'full-time',
    160000,
    200000,
    'USD',
    'Define the design language for precision architectural tools. This role requires an obsession with typographic hierarchy, mathematical spacing systems, and purposeful micro-interactions that elevate technical workflows.',
    'Portfolio demonstrating complex desktop or web-based software systems. Deep understanding of human factors, spatial density, and component-level specifications.',
    'Figma, Design Systems, Typography, Interaction Design, Prototyping',
    'lead',
    'active',
    0
  );

  const job5 = insertJob.run(
    emp1.lastInsertRowid,
    'Site Reliability & Infrastructure Engineer',
    'Strata Works',
    'Remote',
    'remote',
    'full-time',
    145000,
    185000,
    'USD',
    'Help us scale our bare-metal and cloud hybrid footprints. You will write infrastructure-as-code in Terraform, configure observability collectors with Prometheus/Grafana, and participate in blameless post-mortem operational reviews.',
    'Strong Linux internals knowledge, container orchestration experience, and fluency in shell scripting and Go or Python automation.',
    'Kubernetes, Terraform, Prometheus, Linux, CI/CD, Go',
    'senior',
    'active',
    0
  );

  const job6 = insertJob.run(
    emp3.lastInsertRowid,
    'Junior Backend Developer',
    'Kinetic Data',
    'New York, NY',
    'onsite',
    'full-time',
    90000,
    115000,
    'USD',
    'Join our telemetry ingestion team to write reliable ingestion workers, unit tests, and internal developer tooling. Great mentorship and rapid growth environment.',
    'Strong foundational understanding of data structures, algorithms, HTTP protocol, SQL databases, and at least one backend language (Python, Node.js, or Go).',
    'Node.js, PostgreSQL, Git, Docker, REST APIs',
    'entry',
    'active',
    0
  );

  // 5. Applications
  const insertApp = db.prepare(`
    INSERT INTO applications (job_id, seeker_id, cover_letter, status, employer_notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertApp.run(
    job1.lastInsertRowid,
    seeker1.lastInsertRowid,
    'I have spent the past five years operating multi-datacenter consensus clusters with Raft in production. My work directly matches your team roadmap for zero-loss failover and sub-millisecond heartbeat loops.',
    'shortlisted',
    'Exceptional background in consensus protocols. Scheduled for technical discussion.'
  );

  insertApp.run(
    job2.lastInsertRowid,
    seeker2.lastInsertRowid,
    'My recent work revolves around mathematical type scales and high-performance layout rendering for web design software. I would love to contribute to Monolith Labs web CAD initiatives.',
    'reviewing',
    'Strong portfolio in design systems and WebGL components.'
  );

  // 6. Saved Jobs
  const insertSaved = db.prepare(`
    INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)
  `);
  insertSaved.run(seeker1.lastInsertRowid, job5.lastInsertRowid);
  insertSaved.run(seeker2.lastInsertRowid, job4.lastInsertRowid);

  console.log('Database seeded successfully with initial users, jobs, and applications.');
}

module.exports = seedDatabase;
