// Skills check: compares a list of requirements with what this site actually shows.
// The terminal uses it for the fit command (terminal.js), and the assistant uses it to answer
// questions like "does he know Python?" (api/_bot/brain.js), so both give the same answer.
//
// To change an answer, edit the list below. Nothing is guessed: a skill that is not in the list
// is reported as "not shown". dev/tests/fit.test.js checks every entry against the site text.
//
// Each entry has:
//   status    yes = shown on the site, part = partly shown, learn = learning or planned, no = not shown
//   aliases   the ways someone might write it (lower case)
//   weak      aliases that are also everyday words, so they are ignored inside long sentences
//   proof     one plain sentence that can be traced to a page on this site
//   near      for "no" entries: the closest thing the site does show
//   asked     optional wording used when the assistant answers a question about it
//   projects  project numbers, the same numbers the project command uses
//   seen      phrases that must appear on the site for the entry to be true
//   group     true when the entry covers several different things, so the typed words are shown
//   terminalOnly  true when the assistant has its own topic for it, so only the fit command uses it
(function (root, make) {
  if (typeof module === "object" && module.exports) {
    module.exports = make();
  } else {
    root.siteFit = make();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const ENTRIES = [
    // ---------- roles and levels ----------
    {
      id: "soc-analyst", name: "SOC analyst", status: "part", label: "related",
      aliases: ["soc analyst", "soc", "security operations centre", "security operations center"],
      proof: "Not a role he lists. The closest work on the site is the ARP poisoning detector, which watches network traffic and raises alerts. The site shows no SOC job.",
      asked: "Not a role he lists. The closest work is the ARP poisoning detector, which watches network traffic and raises alerts. The site shows no SOC job.",
      projects: [5], seen: ["ARP poisoning detector", "raises 3 alerts"],
    },
    {
      id: "security-analyst", name: "Security analyst", status: "part", label: "related",
      aliases: ["security analyst", "cyber security analyst", "cybersecurity analyst", "cyber analyst", "information security analyst", "infosec analyst", "it security analyst"],
      proof: "Not a role he lists, but five of his projects are security projects and his degree has a cyber security major. The site shows no security analyst job.",
      asked: "Not a role he lists, but five of his projects are security projects. The site shows no security analyst job.",
      projects: [1, 3, 4, 5], seen: ["100 attack inputs", "cyber security major"],
    },
    {
      id: "pentester", name: "Junior penetration tester", status: "part", label: "related",
      aliases: ["penetration tester", "pen tester", "pentester", "junior penetration tester", "junior pentester", "junior pen tester"],
      proof: "Not a role he lists. Ethical Hacking is one of his subjects and he is building an Active Directory attack lab, but no attacks have been run yet and no penetration test report is on the site.",
      asked: "Not a role he lists. Ethical Hacking is one of his subjects and he is building an Active Directory attack lab, but the attacks have not been run yet.",
      projects: [4], seen: ["Ethical Hacking", "attacks come next"],
    },
    {
      id: "it-support", name: "IT support", status: "yes", label: "target role",
      aliases: ["it support", "help desk", "helpdesk", "service desk", "servicedesk", "desktop support", "technical support", "tech support", "it technician", "support technician", "it helpdesk", "level 1 support", "first line support", "1st line support"],
      proof: "It is one of the roles he is looking for. He holds the Google Technical Support Fundamentals certificate and built a Windows domain lab.",
      asked: "A role he is looking for. The site shows no paid job in it. He holds the Google Technical Support Fundamentals certificate and built a Windows domain lab.",
      projects: [4], seen: ["IT support", "Google Technical Support Fundamentals"],
    },
    {
      id: "software-dev", name: "Software developer", status: "yes", label: "target role",
      aliases: ["software developer", "software engineer", "developer", "software engineering", "software development", "programmer", "backend developer", "back end developer", "backend engineer", "back end engineer", "full stack developer", "full stack engineer", "web developer"],
      proof: "It is one of the roles he is looking for. The software work on the site is the capstone backend, LayerLens, the retail system and TalentMatch Pro. The capstone and LayerLens are tagged for backend developer.",
      asked: "A role he is looking for. The site shows no paid software job. The capstone and LayerLens are tagged for backend developer.",
      projects: [1, 3, 6, 7], seen: ["graduate software, IT support and systems roles", "backend developer"],
    },
    {
      id: "appsec", name: "Application security", status: "part", label: "related",
      aliases: ["application security", "appsec", "app security"],
      proof: "The capstone upload scanner and LayerLens are tagged for application security. They are projects, not a job.",
      asked: "Not a role he lists, but the capstone upload scanner and LayerLens are tagged for it.",
      projects: [1, 3], seen: ["application security"],
    },
    {
      id: "sysadmin", name: "Systems administrator", status: "part", label: "related",
      aliases: ["systems administrator", "system administrator", "sysadmin", "sys admin", "systems admin", "system admin", "windows administrator", "windows admin", "it administrator", "it admin"],
      proof: "The Active Directory lab is tagged for systems administrator. He built a Windows domain in a lab. No admin job is on the site.",
      asked: "Not a role he lists, but the Active Directory lab is tagged for it. No admin job is on the site.",
      projects: [4], seen: ["systems administrator"],
    },
    {
      id: "netsec", name: "Network security", status: "yes",
      aliases: ["network security", "network defence", "network defense"],
      proof: "The ARP poisoning detector is tagged for network security, and Network Security is one of his subjects.",
      projects: [5], seen: ["Network Security"],
    },
    {
      id: "cyber", name: "Cyber security", status: "yes",
      aliases: ["cyber security", "cybersecurity", "information security", "infosec", "it security", "system security"],
      proof: "His degree has a cyber security major, and five of his projects are security projects.",
      projects: [1, 3, 4, 5], seen: ["cyber security major", "System Security"],
    },
    {
      id: "level-grad", name: "Graduate level", status: "yes", label: "level", terminalOnly: true,
      aliases: ["graduate", "grad", "junior", "entry level", "new grad", "graduate role", "graduate roles", "graduate program", "graduate programme"],
      weak: ["graduate", "grad", "junior"],
      proof: "He graduates in December 2026 and is looking for graduate roles.",
      projects: [], seen: ["graduate software, IT support and systems roles", "Dec 2026"],
    },
    {
      id: "level-senior", name: "Senior level", status: "no", label: "stretch", group: true, terminalOnly: true,
      aliases: ["senior", "lead", "principal", "manager", "director", "head of", "architect", "mid level", "mid senior", "intermediate"],
      weak: ["senior", "lead", "principal", "manager", "director", "head of", "architect", "mid level", "mid senior", "intermediate"],
      proof: "He is a final-year student, so senior and mid-level roles are a stretch. He is looking for graduate roles.",
      projects: [], seen: ["final-year", "graduate software, IT support and systems roles"],
    },
    {
      // found by the "3 years" pattern in check(), not by a word
      id: "level-years", name: "Years of experience", status: "no", label: "stretch", group: true, terminalOnly: true,
      aliases: [],
      proof: "He graduates in December 2026. Type work to see the jobs he has had so far.",
      projects: [], seen: ["Dec 2026"],
    },
    {
      // only the capital letters IT count, so the ordinary word "it" is never matched
      id: "it-field", name: "IT", status: "part", terminalOnly: true, capsOnly: ["it"],
      aliases: ["information technology", "it degree", "information systems"],
      proof: "His degree is Computer Science with a cyber security major, and he is open to IT support roles.",
      projects: [], seen: ["Computer Science", "IT support"],
    },

    // ---------- security work ----------
    {
      id: "upload-security", name: "Secure file upload checks", status: "yes",
      aliases: ["file upload security", "secure file upload", "upload security", "file upload", "file uploads", "upload scanner", "upload scanning", "file scanning", "file validation", "file inspection", "antivirus", "anti virus"],
      proof: "The capstone scanner checks file signatures and inspects PDFs, ZIP archives, images and documents for threats.",
      projects: [1], seen: ["checks file signatures", "ZIP archives"],
    },
    {
      id: "malware", name: "Malware detection in uploads", status: "part",
      aliases: ["malware", "malware detection", "malware scanning", "virus", "viruses", "virus scanning", "virus detection"],
      proof: "The upload scanner blocks the EICAR test file and zip bombs, and flags macros for a manager. That is detection in uploads, not malware analysis.",
      projects: [1], seen: ["EICAR", "zip bomb", "macros"],
    },
    {
      id: "malware-analysis", name: "Malware analysis", status: "no", group: true,
      aliases: ["malware analysis", "reverse engineering", "reversing", "sandbox analysis"],
      near: "The upload scanner checks files for threats such as the EICAR test file. That is detection, not malware analysis.",
      projects: [1], seen: ["EICAR"],
    },
    {
      id: "clamav", name: "ClamAV", status: "part",
      aliases: ["clamav", "clam av"],
      proof: "The upload scanner can stream files to a ClamAV server when one is set up. In his setup it is optional.",
      projects: [1], seen: ["ClamAV", "In my setup it is optional"],
    },
    {
      id: "traffic", name: "Network traffic analysis", status: "yes",
      aliases: ["network traffic analysis", "traffic analysis", "packet analysis", "packet capture", "packet captures", "pcap", "packet sniffing", "sniffing", "network analysis"],
      proof: "He inspected forged ARP packets in Wireshark, and his detector reads live traffic or a saved capture file with Scapy.",
      projects: [5], seen: ["used Wireshark to look at the forged packets", "capture file"],
    },
    {
      id: "wireshark", name: "Wireshark", status: "yes",
      aliases: ["wireshark"],
      proof: "Used to inspect forged ARP packets in the group lab.",
      projects: [5], seen: ["used Wireshark to look at the forged packets"],
    },
    {
      id: "scapy", name: "Scapy", status: "yes",
      aliases: ["scapy"],
      proof: "The ARP detector uses Scapy to capture and read packets, live or from a saved capture file.",
      projects: [5], seen: ["Scapy captures packets"],
    },
    {
      id: "arp", name: "ARP spoofing and poisoning", status: "yes",
      aliases: ["arp", "arp poisoning", "arp spoofing", "arp cache poisoning", "arp poisoning detection"],
      proof: "He ran ARP spoofing in a group lab. His detector is a tidied and extended copy of the group tool.",
      projects: [5], seen: ["we ran ARP spoofing", "tidied and extended"],
    },
    {
      id: "mitm", name: "Man in the middle attacks", status: "yes",
      aliases: ["man in the middle", "mitm", "man in the middle attack", "man in the middle attacks"],
      proof: "The ARP detector targets man in the middle attacks, listed in MITRE ATT&CK as T1557.002.",
      projects: [5], seen: ["man-in-the-middle", "T1557.002"],
    },
    {
      id: "detection", name: "Threat detection", status: "part",
      aliases: ["detection", "threat detection", "attack detection"],
      proof: "The ARP poisoning detector raises alerts from live traffic or capture files. It is one small, ARP-only detector. No SIEM detection rules are on the site.",
      projects: [5], seen: ["raises an alert when one MAC address claims several IPs", "IPv4 ARP only"],
    },
    {
      id: "detection-rules", name: "Detection rules", status: "no", group: true,
      aliases: ["detection engineering", "detection rules", "sigma", "sigma rules", "yara", "yara rules", "kql", "spl", "snort rules", "suricata rules"],
      near: "The ARP detector is a small Python tool. No detection rules for a SIEM are on the site.",
      projects: [5], seen: ["small Python tool"],
    },
    {
      id: "ids", name: "Intrusion detection systems", status: "no", group: true,
      aliases: ["intrusion detection", "ids", "idps", "snort", "suricata", "zeek"],
      weak: ["ids"],
      near: "The ARP poisoning detector is a small ARP-only detector, not a full intrusion detection system.",
      projects: [5], seen: ["IPv4 ARP only"],
    },
    {
      id: "siem", name: "SIEM and EDR tools", status: "no", group: true,
      aliases: ["siem", "splunk", "sentinel", "microsoft sentinel", "azure sentinel", "qradar", "elastic", "elk", "elk stack", "elasticsearch", "kibana", "wazuh", "security onion", "graylog", "edr", "crowdstrike", "microsoft defender", "defender", "sentinelone", "carbon black", "endpoint detection"],
      weak: ["elastic", "defender"],
      near: "Windows event logs are planned in the Active Directory lab.",
      projects: [4], seen: ["Windows event logs"],
    },
    {
      id: "log-analysis", name: "Log analysis", status: "learn",
      aliases: ["log analysis", "log management", "log monitoring", "log review", "event logs", "windows event logs", "windows event log", "event log"],
      proof: "Planned in the Active Directory lab: write up each attack and how to detect it, and use the Windows event logs. No log results are on the site yet.",
      projects: [4], seen: ["how to detect it", "Windows event logs"],
    },
    {
      id: "incident-response", name: "Incident response", status: "no", group: true,
      aliases: ["incident response", "incident handling", "incident management", "ir", "dfir", "digital forensics", "forensics", "forensic analysis", "triage", "alert triage", "threat hunting", "threat intelligence", "cti", "playbook", "playbooks", "soar"],
      weak: ["ir", "triage", "cti", "playbook", "playbooks"],
      near: "The capstone has an audit page for blocked uploads, and the ARP detector can write a log of its alerts. No incident response write-up is on the site.",
      projects: [1, 5], seen: ["audit page", "write a log"],
    },
    {
      id: "mitre", name: "MITRE ATT&CK", status: "yes",
      aliases: ["mitre", "mitre att ck", "mitre attack", "att ck", "attck", "ttp", "ttps", "t1557", "t1558"],
      proof: "The ARP detector and Active Directory lab write-ups map attacks to ATT&CK technique IDs (T1557.002, T1557.001, T1558.003).",
      projects: [4, 5], seen: ["MITRE ATT&CK", "T1557.001", "T1558.003"],
    },
    {
      id: "kali", name: "Kali Linux", status: "yes",
      aliases: ["kali", "kali linux"],
      proof: "Used to run ARP spoofing in the group lab. A Kali machine is also part of the Active Directory lab but is not connected yet.",
      projects: [4, 5], seen: ["Kali Linux", "Not connected yet"],
    },
    {
      id: "metasploitable", name: "Metasploitable", status: "yes",
      aliases: ["metasploitable"],
      proof: "It was the target machine in the group ARP spoofing lab.",
      projects: [5], seen: ["Metasploitable"],
    },
    {
      id: "metasploit", name: "Metasploit", status: "no", group: true,
      aliases: ["metasploit", "msfconsole", "msf", "meterpreter"],
      weak: ["msf"],
      near: "Metasploitable was the target machine in the ARP spoofing lab, but the Metasploit framework itself is not on the site.",
      projects: [5], seen: ["Metasploitable"],
    },
    {
      id: "hydra", name: "Hydra", status: "no", group: true,
      aliases: ["hydra", "thc hydra"],
      near: "The only Hydra on the site is HYDRA-DC, the name of the lab domain controller. The password tool is not mentioned.",
      projects: [4], seen: ["HYDRA-DC"],
    },
    {
      id: "offensive-tools", name: "Scanning and attack tools", status: "no", group: true,
      aliases: ["nmap", "nikto", "sqlmap", "john the ripper", "gobuster", "ffuf", "aircrack", "aircrack ng"],
      near: "Kali Linux and Wireshark are the security tools named on the site.",
      projects: [4, 5], seen: ["Kali Linux", "Wireshark"],
    },
    {
      id: "pentest", name: "Penetration testing", status: "part",
      aliases: ["penetration testing", "pentesting", "pentest", "pen testing", "pen test", "ethical hacking", "ethical hacker", "offensive security"],
      proof: "Ethical Hacking is one of his subjects. He ran ARP spoofing in a group lab and is building an attack lab. No penetration test report is on the site.",
      projects: [4, 5], seen: ["Ethical Hacking"],
    },
    {
      id: "ctf", name: "CTFs and practice platforms", status: "no", group: true,
      aliases: ["ctf", "ctfs", "capture the flag", "tryhackme", "try hack me", "hack the box", "hackthebox", "htb", "overthewire", "picoctf", "vulnhub", "portswigger academy", "web security academy"],
      weak: ["htb"],
      proof: "The practice on the site is the lab he built himself. CTFs and practice platforms are not mentioned.",
      projects: [4], seen: ["Active Directory home lab"],
    },
    {
      id: "bug-bounty", name: "Bug bounty", status: "no", group: true,
      aliases: ["bug bounty", "bug bounties", "hackerone", "bugcrowd", "responsible disclosure", "vulnerability disclosure"],
      proof: "No bug bounty or disclosure work is on the site.",
      projects: [], seen: ["Cyber security"],
    },
    {
      id: "vuln", name: "Vulnerability scanning", status: "no", group: true,
      aliases: ["vulnerability assessment", "vulnerability scanning", "vulnerability management", "vulnerability", "vulnerabilities", "nessus", "openvas", "qualys"],
      weak: ["vulnerability", "vulnerabilities"],
      near: "The upload scanner checks files for dangerous content. That is different from scanning systems for vulnerabilities.",
      projects: [1], seen: ["checks file signatures"],
    },
    {
      id: "webtest", name: "Web application testing", status: "no", group: true,
      aliases: ["burp", "burp suite", "owasp zap", "zap", "web application testing", "web app testing", "web application security", "web app security", "xss", "sql injection", "sqli", "owasp top 10", "owasp top ten", "juice shop", "dvwa"],
      weak: ["zap"],
      near: "The capstone is a web backend with upload checks, and its case study cites the OWASP File Upload Cheat Sheet.",
      projects: [1], seen: ["OWASP File Upload Cheat Sheet"],
    },
    {
      id: "owasp", name: "OWASP", status: "part",
      aliases: ["owasp"],
      proof: "The capstone case study cites the OWASP File Upload Cheat Sheet and CWE-434, and the LayerLens page lists the OWASP SSRF Prevention Cheat Sheet. No wider OWASP testing is on the site.",
      projects: [1, 3], seen: ["OWASP File Upload Cheat Sheet", "CWE-434", "OWASP SSRF Prevention Cheat Sheet"],
    },
    {
      id: "secure-coding", name: "Secure coding", status: "yes",
      aliases: ["secure coding", "secure development", "input validation", "input sanitisation", "input sanitization", "rate limiting", "rate limit", "ssrf", "server side request forgery"],
      proof: "The capstone scanner rate-limits uploads, escapes alert text in messages and checks ids before any lookup. LayerLens rejects requests that name a target, which avoids SSRF, and limits request size and calls per visitor.",
      projects: [1, 3], seen: ["Rate limit", "Alert text is escaped", "isObjectIdOrHexString", "a request cannot name a target", "calls per visitor per minute"],
    },
    {
      id: "threat-model", name: "Threat modelling", status: "part",
      aliases: ["threat modelling", "threat modeling", "threat model", "threat models"],
      proof: "LayerLens has a written threat model with nine risks, the control for each and what is still untested. No formal method is described.",
      projects: [3], seen: ["lists nine risks", "Web app threat modelling and request limits"],
    },
    {
      id: "tls-fingerprints", name: "TLS fingerprints", status: "part",
      aliases: ["ja3", "ja4", "tls fingerprinting", "tls fingerprint", "tls fingerprints", "fingerproxy"],
      proof: "LayerLens has an optional diagnostic for JA3, JA4 and HTTP/2 fingerprints through Fingerproxy. Its server side is tested with fake headers, but it has not been run against real TLS traffic.",
      projects: [3], seen: ["JA3, JA4 and HTTP/2 through Fingerproxy", "has not been run against real TLS traffic"],
    },

    // ---------- systems and networks ----------
    {
      id: "ad", name: "Active Directory", status: "yes",
      aliases: ["active directory", "ad", "ad ds", "adds", "domain services", "active directory domain services", "windows domain", "windows domains", "domain controller"],
      weak: ["ad", "adds"],
      proof: "He built the marvel.local domain in a lab: a Windows Server 2022 domain controller and a Windows 11 client.",
      projects: [4], seen: ["marvel.local", "Windows Server 2022"],
    },
    {
      id: "adcs", name: "Active Directory Certificate Services", status: "yes",
      aliases: ["ad cs", "adcs", "certificate services", "active directory certificate services"],
      proof: "He set up Certificate Services on the lab domain controller.",
      projects: [4], seen: ["Certificate Services"],
    },
    {
      id: "gpo", name: "Group Policy", status: "yes",
      aliases: ["group policy", "gpo", "gpos", "group policies"],
      proof: "Group Policy is set up in the lab domain.",
      projects: [4], seen: ["Group Policy"],
    },
    {
      id: "windows", name: "Windows", status: "yes",
      aliases: ["windows", "windows server", "windows server 2022", "windows 11", "microsoft windows"],
      proof: "Windows Server 2022 and Windows 11 run in his lab domain.",
      projects: [4], seen: ["Windows Server 2022", "Windows 11"],
    },
    {
      id: "windows10", name: "Windows 10", status: "no", group: true,
      aliases: ["windows 10"],
      near: "Windows 11 and Windows Server 2022 are the Windows versions in his lab.",
      projects: [4], seen: ["Windows 11"],
    },
    {
      id: "linux", name: "Linux", status: "yes",
      aliases: ["linux"],
      proof: "Kali Linux is used in the labs, and Linux is listed with VirtualBox in his IT skills.",
      projects: [4, 5], seen: ["VirtualBox and Linux"],
    },
    {
      id: "shell", name: "Bash and shell scripting", status: "no", group: true,
      aliases: ["bash", "shell scripting", "bash scripting", "shell", "powershell", "linux administration", "linux admin", "command line"],
      weak: ["shell"],
      near: "Python is the scripting language he shows. Bash and PowerShell are not listed as skills.",
      projects: [5, 8], seen: ["Python"],
    },
    {
      id: "virtualbox", name: "VirtualBox", status: "yes",
      aliases: ["virtualbox", "virtualization", "virtualisation", "virtual machines", "virtual machine", "vm", "vms"],
      weak: ["vm", "vms"],
      proof: "The Active Directory lab runs in VirtualBox.",
      projects: [4], seen: ["VirtualBox"],
    },
    {
      id: "hypervisor", name: "Other virtualisation tools", status: "no", group: true,
      aliases: ["vmware", "hyper v", "proxmox", "esxi"],
      near: "VirtualBox is the virtualisation tool in his lab.",
      projects: [4], seen: ["VirtualBox"],
    },
    {
      id: "networking", name: "Networking", status: "part",
      aliases: ["networking", "networks", "network", "tcp ip", "tcpip", "osi", "osi model", "lan", "subnetting", "ip addressing", "static ip", "static ips", "network fundamentals"],
      weak: ["networks", "network", "lan"],
      proof: "Network Security is one of his subjects. He looked at ARP traffic and set static IPs on an internal lab network, and LayerLens works with IP addresses, reverse DNS and proxy headers. No routing or switching work is on the site.",
      projects: [3, 4, 5], seen: ["Network Security", "static IP", "reverse DNS"],
    },
    {
      id: "dns", name: "DNS", status: "part",
      aliases: ["dns"],
      proof: "The lab domain controller runs DNS. LayerLens can look up reverse DNS records, but that has only run against a local test DNS server. No other DNS work is on the site.",
      projects: [3, 4], seen: ["DNS", "Reverse DNS has only run against a local test DNS server"],
    },
    {
      id: "dhcp", name: "DHCP", status: "no", group: true,
      aliases: ["dhcp"],
      near: "DHCP snooping is mentioned in the ARP defences write-up. It is part of a defence he compared, not hands-on work.",
      projects: [5], seen: ["DHCP snooping"],
    },
    {
      id: "network-gear", name: "Network equipment", status: "no", group: true,
      aliases: ["firewall", "firewalls", "vpn", "cisco", "routing", "switching", "router", "routers", "switch"],
      weak: ["switch", "switching"],
      near: "Network work on the site is ARP traffic analysis and the lab network. The Cisco Networking Academy course is an introduction to cybersecurity, not network equipment.",
      projects: [4, 5], seen: ["ARP"],
    },
    {
      id: "containers", name: "Docker and containers", status: "part",
      aliases: ["docker", "docker compose", "dockerfile", "containers", "container", "containerisation", "containerization"],
      weak: ["container", "containers"],
      proof: "LayerLens has a Dockerfile and a Compose file that run it as a non-root user with a read-only filesystem. It was built and run once on Linux, and nothing is deployed from it.",
      projects: [3], seen: ["Dockerfile and Compose file", "It was built and run once on Linux"],
    },
    {
      id: "container-tools", name: "Kubernetes and other container tools", status: "no", group: true,
      aliases: ["kubernetes", "k8s", "podman", "helm"],
      weak: ["helm"],
      near: "Docker is the only container tool on the site. It packages LayerLens.",
      projects: [3], seen: ["Docker and Compose (LayerLens)"],
    },
    {
      id: "serverless", name: "Serverless functions", status: "part",
      aliases: ["serverless", "serverless functions", "serverless function", "vercel", "vercel functions", "serverless api"],
      weak: ["serverless", "vercel"],
      proof: "The site assistant runs as serverless functions on Vercel. No AWS Lambda or other cloud platform work is shown.",
      projects: [2], seen: ["Serverless functions on Vercel"],
    },
    {
      id: "cloud", name: "Cloud platforms", status: "no", group: true,
      aliases: ["aws", "amazon web services", "azure", "microsoft azure", "gcp", "google cloud", "cloud", "cloud computing", "cloud security", "cloud platform", "cloud platforms", "lambda"],
      weak: ["cloud", "lambda"],
      proof: "No AWS, Azure or Google Cloud work is shown on the site. The only hosted work is the site assistant, which runs as serverless functions on Vercel, and the Active Directory lab runs in VirtualBox.",
      projects: [2, 4], seen: ["VirtualBox", "Serverless functions on Vercel"],
    },
    {
      id: "github-actions", name: "GitHub Actions", status: "yes",
      aliases: ["github actions", "github action", "github workflow", "github workflows"],
      proof: "A GitHub Actions workflow runs the LayerLens tests on Node.js 22 and 24 for every push, and another runs the ARP detector tests on Windows and Linux with Python 3.11, 3.12 and 3.13.",
      projects: [3, 5], seen: ["GitHub Actions runs them on Node.js 22 and 24 for every push", "Windows and Linux with Python 3.11, 3.12 and 3.13 in GitHub Actions"],
    },
    {
      id: "cicd", name: "CI/CD", status: "part",
      aliases: ["ci cd", "cicd", "continuous integration", "continuous delivery", "continuous deployment", "pipeline", "pipelines", "build pipeline"],
      weak: ["pipeline", "pipelines"],
      proof: "LayerLens and the ARP detector each have a GitHub Actions workflow that runs their tests. Nothing is deployed from them, so no delivery or deployment pipeline is on the site.",
      projects: [3, 5], seen: ["GitHub Actions runs them on Node.js 22 and 24 for every push", "Windows and Linux with Python 3.11, 3.12 and 3.13 in GitHub Actions"],
    },
    {
      id: "devops-tools", name: "Other CI tools and DevOps", status: "no", group: true,
      aliases: ["jenkins", "gitlab ci", "devops"],
      near: "The only automation on the site is the GitHub Actions workflows that run the LayerLens and ARP detector tests.",
      projects: [3, 5], seen: ["GitHub Actions runs them on Node.js 22 and 24 for every push", "Windows and Linux with Python 3.11, 3.12 and 3.13 in GitHub Actions"],
    },
    {
      id: "iac", name: "Infrastructure as code", status: "no", group: true,
      aliases: ["terraform", "ansible", "infrastructure as code", "iac", "puppet", "chef", "cloudformation"],
      weak: ["chef", "puppet", "iac"],
      proof: "Not mentioned on the site. The Active Directory lab was built in VirtualBox while following a guided course.",
      projects: [4], seen: ["guided course"],
    },
    {
      id: "agile", name: "Agile and Scrum", status: "no", group: true,
      aliases: ["agile", "scrum", "kanban", "sprint", "sprints", "scrum master", "stand up", "stand ups", "standup", "standups", "retrospective", "retrospectives"],
      weak: ["sprint", "sprints", "stand up", "stand ups", "standup", "standups", "retrospective", "retrospectives"],
      proof: "The site does not say which project method his teams used.",
      projects: [1, 7], seen: ["Team project"],
    },
    {
      id: "ticketing", name: "Ticketing and service management", status: "no", group: true,
      aliases: ["ticketing", "ticketing system", "ticketing systems", "ticket system", "jira", "servicenow", "service now", "zendesk", "freshdesk", "remedy", "itil", "service management"],
      weak: ["ticketing", "remedy", "service management"],
      proof: "The site does not mention ticketing tools. He holds the Google Technical Support Fundamentals certificate.",
      projects: [], seen: ["Google Technical Support Fundamentals"],
    },
    {
      id: "m365", name: "Microsoft 365 and Office", status: "no", group: true,
      aliases: ["microsoft 365", "office 365", "m365", "o365", "microsoft office", "ms office", "office suite", "exchange online", "exchange", "sharepoint", "intune", "outlook", "excel", "powerpoint"],
      weak: ["exchange", "outlook", "excel"],
      proof: "The site does not mention Microsoft Office or its online services. His Windows work is Windows Server 2022 and Windows 11 in the lab.",
      projects: [4], seen: ["Windows Server 2022"],
    },
    {
      id: "grc", name: "Compliance and risk frameworks", status: "no", group: true,
      aliases: ["grc", "governance risk and compliance", "compliance", "risk assessment", "risk management", "iso 27001", "iso27001", "nist", "nist csf", "essential eight", "essential 8", "pci dss"],
      weak: ["compliance"],
      proof: "The site does not mention compliance or risk frameworks. The case studies cite OWASP, CWE and MITRE ATT&CK.",
      projects: [1, 4, 5], seen: ["OWASP", "CWE-434", "MITRE ATT&CK"],
    },
    {
      id: "smb", name: "SMB file shares", status: "yes",
      aliases: ["smb", "smb share", "smb shares", "file share", "file shares", "file sharing"],
      proof: "He set up an SMB file share in the lab domain.",
      projects: [4], seen: ["SMB file share"],
    },
    {
      id: "kerberos", name: "Kerberoasting", status: "learn",
      aliases: ["kerberoasting", "kerberoast", "kerberos", "spn", "service principal name"],
      proof: "A service account with an SPN is set up in the lab for Kerberoasting. The attack itself has not been run yet.",
      projects: [4], seen: ["Kerberoasting", "SPN"],
    },
    {
      id: "llmnr", name: "LLMNR poisoning", status: "learn",
      aliases: ["llmnr", "llmnr poisoning", "nbt ns", "nbt ns poisoning", "mdns"],
      proof: "LLMNR poisoning is planned as one of the first attacks in the Active Directory lab. It has not been run yet.",
      projects: [4], seen: ["LLMNR", "I will run first"],
    },
    {
      id: "relay", name: "SMB relay", status: "learn",
      aliases: ["smb relay", "ntlm relay", "relay attack", "relay attacks"],
      proof: "SMB relay is planned in the Active Directory lab. It needs a second client, which is on his list.",
      projects: [4], seen: ["SMB relay", "second client"],
    },
    {
      id: "next-tools", name: "Responder, Impacket and Hashcat", status: "learn", group: true,
      aliases: ["responder", "impacket", "hashcat"],
      proof: "Listed as next in the Active Directory lab. He has not used it yet.",
      projects: [4], seen: ["Responder, Impacket, Hashcat"],
    },
    {
      id: "iam", name: "Cloud identity", status: "no", group: true,
      aliases: ["azure ad", "azure active directory", "entra", "entra id", "aad", "okta", "single sign on", "sso", "identity and access management", "iam"],
      weak: ["aad"],
      near: "His Active Directory work is a lab domain in VirtualBox. No cloud identity work is on the site.",
      projects: [4], seen: ["VirtualBox"],
    },
    {
      id: "oauth", name: "OAuth and SAML", status: "no", group: true,
      aliases: ["oauth", "oauth2", "oauth 2", "oidc", "openid", "saml"],
      near: "TalentMatch Pro uses JWT login, and the capstone has role-based permissions.",
      projects: [1, 7], seen: ["JWT login", "role-based"],
    },

    // ---------- certificates, degree, study ----------
    {
      id: "certs", name: "Other certificates", status: "no", group: true,
      aliases: ["security+", "security plus", "comptia security+", "comptia security", "network+", "a+", "comptia a+", "cysa+", "cysa", "ceh", "oscp", "osep", "ejpt", "cissp", "cism", "ccna", "az 900", "sc 200", "sc 900", "btl1", "gsec", "giac"],
      near: "The certificates on the site are Google Technical Support Fundamentals and the Cisco Networking Academy Introduction to Cybersecurity course (both done). Neither is an exam such as CCNA.",
      projects: [], seen: ["Google Technical Support Fundamentals", "Introduction to Cybersecurity"],
    },
    {
      id: "google-tsf", name: "Google Technical Support Fundamentals", status: "yes",
      aliases: ["google technical support fundamentals", "technical support fundamentals", "coursera"],
      proof: "Coursera certificate, Oct 2026. It can be verified on Coursera.",
      projects: [], seen: ["Google Technical Support Fundamentals", "Verify on Coursera"],
    },
    {
      id: "cisco-intro-cyber", name: "Cisco Introduction to Cybersecurity course", status: "yes",
      aliases: ["cisco certificate", "cisco certification", "cisco cert", "cisco course", "cisco networking academy", "cisco academy", "netacad", "introduction to cybersecurity", "intro to cybersecurity", "cisco introduction to cybersecurity", "cisco intro to cybersecurity"],
      proof: "Cisco Networking Academy course, Nov 2026, at student level. It can be verified on Credly.",
      projects: [], seen: ["Introduction to Cybersecurity", "Verify on Credly"],
    },
    {
      id: "google-it", name: "Google IT Support certificate", status: "part",
      aliases: ["google it support", "google it support certificate", "google it support professional certificate", "google certificate", "google it certificate"],
      proof: "The site lists one Google course certificate: Technical Support Fundamentals (Oct 2026).",
      projects: [], seen: ["Google Technical Support Fundamentals"],
    },
    {
      id: "degree", name: "Degree", status: "yes",
      aliases: ["degree", "bachelor", "bachelors", "bachelor s", "bachelor of computer science", "computer science", "cs degree", "bsc", "university degree", "tertiary qualification", "undergraduate", "university", "uni", "uow", "university of wollongong"],
      weak: ["undergraduate", "university", "uni"],
      proof: "Bachelor of Computer Science with a cyber security major at the University of Wollongong, graduating December 2026.",
      projects: [], seen: ["Bachelor of Computer Science", "University of Wollongong"],
    },
    {
      id: "algorithms", name: "Algorithms and data structures", status: "part",
      aliases: ["algorithms", "data structures", "algorithms and data structures", "dsa"],
      proof: "Algorithms and Data Structures is one of his subjects, and TalentMatch Pro uses Levenshtein distance for typo-tolerant search.",
      projects: [6], seen: ["Algorithms and Data Structures", "Levenshtein distance"],
    },

    // ---------- software ----------
    {
      id: "programming", name: "Programming", status: "yes", terminalOnly: true,
      aliases: ["programming", "coding", "programming languages", "software programming"],
      proof: "Python in the ARP detector and the loan model, Java in the retail system, and Node.js in the capstone, LayerLens and TalentMatch Pro.",
      projects: [1, 3, 5, 6, 7, 8], seen: ["Python", "Java 21", "Node.js"],
    },
    {
      id: "python", name: "Python", status: "yes",
      aliases: ["python", "python3", "python 3"],
      proof: "Used in the ARP poisoning detector and the loan default model.",
      projects: [5, 8], seen: ["Python, Scapy", "Python, Apache Spark"],
    },
    {
      id: "cpp", name: "C++", status: "part",
      aliases: ["c++", "cpp", "c plus plus"],
      proof: "Listed in his skills. No project on the site uses it.",
      projects: [], seen: ["Python and C++"],
    },
    {
      id: "java", name: "Java", status: "yes",
      aliases: ["java", "java 21", "jdk"],
      proof: "The online retail system is built in Java 21 with Spring Boot. That project is still in progress.",
      projects: [7], seen: ["Java 21", "In progress, team of three"],
    },
    {
      id: "spring-kafka", name: "Spring Boot and Kafka", status: "yes",
      aliases: ["spring", "spring boot", "kafka", "apache kafka", "microservices", "microservice", "event driven", "event driven architecture"],
      weak: ["spring"],
      proof: "The retail system has four Spring Boot microservices connected through Kafka events. He owns the Product and Inventory services. It is still in progress.",
      projects: [7], seen: ["Four Spring Boot microservices connected through Kafka events", "Product and Inventory services"],
    },
    {
      id: "node", name: "Node.js and Express", status: "yes",
      aliases: ["node", "node js", "nodejs", "express", "express js", "expressjs"],
      weak: ["node", "express"],
      proof: "Node.js and Express are in the capstone and in TalentMatch Pro. LayerLens also runs on Node.js, with no framework.",
      projects: [1, 3, 6], seen: ["Node.js, Express, MongoDB", "Node.js, Express and SQLite", "Node.js 22 or newer with no packages to install"],
    },
    {
      id: "javascript", name: "JavaScript", status: "yes",
      aliases: ["javascript", "js", "ecmascript"],
      proof: "LayerLens is written in plain JavaScript, on Node.js and in the browser. Node.js, Express and React in the capstone and TalentMatch Pro are JavaScript too.",
      projects: [1, 3, 6], seen: ["Plain JavaScript, HTML and CSS in the browser", "Node.js", "React"],
    },
    {
      id: "react", name: "React", status: "yes",
      aliases: ["react", "react js", "reactjs"],
      weak: ["react"],
      proof: "React is part of the capstone stack and is listed in his skills.",
      projects: [1], seen: ["Node.js with Express and React"],
    },
    {
      id: "socketio", name: "Socket.IO", status: "yes",
      aliases: ["socket io", "socketio"],
      proof: "The capstone sends real-time alerts about blocked files with Socket.IO.",
      projects: [1], seen: ["Socket.IO"],
    },
    {
      id: "mobile", name: "Mobile apps", status: "learn", label: "planned",
      aliases: ["mobile app", "mobile apps", "mobile development", "mobile", "react native", "expo", "firebase"],
      weak: ["mobile"],
      proof: "ExpiryTracker is a mobile app idea at the Figma prototype stage. The planned stack is React Native, Expo and Firebase. Nothing is built yet.",
      asked: "Planned, not built. ExpiryTracker is a mobile app idea at the Figma prototype stage. The planned stack is React Native, Expo and Firebase.",
      projects: [9], seen: ["Planned: React Native, Expo, Firebase", "Figma prototype"],
    },
    {
      id: "figma", name: "Figma", status: "yes",
      aliases: ["figma"],
      proof: "ExpiryTracker is at the Figma prototype stage.",
      projects: [9], seen: ["Figma prototype"],
    },
    {
      id: "sql", name: "SQL", status: "part",
      aliases: ["sql"],
      proof: "TalentMatch Pro uses SQLite, and Database Systems is one of his subjects. No SQL queries are shown on the site.",
      projects: [6], seen: ["SQLite", "Database Systems"],
    },
    {
      id: "sqlite", name: "SQLite", status: "yes",
      aliases: ["sqlite"],
      proof: "TalentMatch Pro uses SQLite.",
      projects: [6], seen: ["Node.js, Express and SQLite"],
    },
    {
      id: "mongodb", name: "MongoDB", status: "yes",
      aliases: ["mongodb", "mongo", "mongoose"],
      proof: "MongoDB is the database in the capstone.",
      projects: [1], seen: ["MongoDB"],
    },
    {
      id: "databases", name: "Databases", status: "yes",
      aliases: ["database", "databases", "database systems", "nosql", "relational database"],
      proof: "MongoDB in the capstone, SQLite in TalentMatch Pro, and Database Systems as a subject.",
      projects: [1, 6], seen: ["MongoDB", "SQLite", "Database Systems"],
    },
    {
      id: "other-db", name: "Other databases", status: "no", group: true,
      aliases: ["mysql", "postgresql", "postgres", "oracle", "sql server", "mssql", "mariadb", "redis", "dynamodb"],
      weak: ["oracle"],
      near: "SQLite (TalentMatch Pro) and MongoDB (the capstone) are the databases on the site.",
      projects: [1, 6], seen: ["SQLite", "MongoDB"],
    },
    {
      id: "rest", name: "REST APIs", status: "yes",
      aliases: ["rest", "rest api", "rest apis", "restful", "api", "apis"],
      weak: ["rest", "api", "apis"],
      proof: "REST APIs with JWT and role-based access is one of his listed skills. TalentMatch Pro uses JWT and the capstone has role-based permissions.",
      projects: [1, 6], seen: ["REST APIs with JWT and role-based access"],
    },
    {
      id: "auth", name: "Authentication and access control", status: "yes",
      aliases: ["jwt", "json web token", "json web tokens", "authentication", "authorization", "authorisation", "access control", "rbac", "role based access", "role based access control", "permissions"],
      proof: "TalentMatch Pro uses JWT login, and the capstone has role-based permissions.",
      projects: [1, 6], seen: ["JWT login", "role-based permissions"],
    },
    {
      id: "testing", name: "Testing", status: "yes",
      aliases: ["testing", "automated testing", "unit testing", "unit tests", "integration testing", "integration tests", "end to end testing", "end to end tests", "e2e", "test automation", "automated tests", "write tests", "writes tests", "writing tests", "test his code", "tests his code", "test code"],
      proof: "62 automated tests in LayerLens, 14 unit tests in the ARP detector, 86 end-to-end tests and 14 backend unit tests in TalentMatch Pro, and integration and Cypress tests in the capstone.",
      projects: [1, 3, 5, 6], seen: ["62 automated tests", "14 unit tests", "86 end-to-end tests", "14 backend unit tests", "Cypress"],
    },
    {
      id: "qa", name: "QA and manual testing", status: "part",
      aliases: ["qa", "quality assurance", "test cases", "manual testing"],
      weak: ["qa"],
      proof: "He writes automated tests in his projects, such as 86 end-to-end tests in TalentMatch Pro. Manual testing and writing test cases are not described.",
      projects: [6], seen: ["86 end-to-end tests"],
    },
    {
      id: "junit", name: "JUnit", status: "yes",
      aliases: ["junit"],
      proof: "JUnit is part of the retail system, which is still in progress.",
      projects: [7], seen: ["JUnit"],
    },
    {
      id: "postman", name: "Postman", status: "yes",
      aliases: ["postman"],
      proof: "He shares the Postman testing in the retail system, which is still in progress.",
      projects: [7], seen: ["Postman, JUnit and integration testing"],
    },
    {
      id: "cypress", name: "Cypress", status: "yes",
      aliases: ["cypress"],
      proof: "Cypress end-to-end tests cover the capstone.",
      projects: [1], seen: ["Cypress"],
    },
    {
      id: "git", name: "Git and GitHub", status: "yes",
      aliases: ["git", "github", "version control", "source control"],
      proof: "30+ commits of his own in the capstone team repository. The Active Directory lab, the ARP detector and LayerLens are public repositories on GitHub, and the ARP detector and LayerLens have GitHub Actions workflows.",
      projects: [1, 3, 4, 5], seen: ["30+ commits", "github.com/hamimabbu/active-directory-home-lab", "github.com/hamimabbu/arp-poisoning-detector", "github.com/hamimabbu/layerlens"],
    },
    {
      id: "ml", name: "Machine learning", status: "yes",
      aliases: ["machine learning", "ml", "tensorflow", "keras", "mllib", "spark mllib", "predictive modelling", "predictive modeling"],
      proof: "Loan default prediction with Spark MLlib and TensorFlow with Keras.",
      projects: [8], seen: ["Spark MLlib", "TensorFlow with Keras"],
    },
    {
      id: "spark", name: "Apache Spark", status: "yes",
      aliases: ["spark", "apache spark", "pyspark"],
      weak: ["spark"],
      proof: "Apache Spark is used in the loan default project.",
      projects: [8], seen: ["Apache Spark"],
    },
    {
      id: "ai", name: "AI", status: "part",
      aliases: ["ai", "artificial intelligence", "llm", "llms", "generative ai"],
      proof: "AI for Cybersecurity is one of his subjects, and the loan default model is machine learning. His site assistant can use an AI model to word answers that are checked against written facts. The AI shopping assistant in the retail project was built by his teammates.",
      projects: [2, 7, 8], seen: ["AI for Cybersecurity", "AI shopping assistant", "An optional AI model can pick the topic"],
    },
    {
      id: "prompt-injection", name: "Prompt injection and AI security", status: "part",
      aliases: ["prompt injection", "llm security", "ai security", "jailbreak", "jailbreaking", "adversarial prompts"],
      proof: "The site assistant filters questions, checks every answer against written facts and is tested with a script of 100 attack inputs. No course or formal work on AI security is shown.",
      projects: [2], seen: ["100 attack inputs"],
    },
    {
      id: "data-science", name: "Data science", status: "part",
      aliases: ["data science", "data scientist", "data analysis"],
      proof: "The loan default project is the data work on the site: model results taken through to a presentation with real metrics.",
      projects: [8], seen: ["real metrics"],
    },
    {
      id: "scripting", name: "Scripting", status: "part",
      aliases: ["scripting", "scripts"],
      weak: ["scripting", "scripts"],
      proof: "His Python tools are the scripting work on the site. Bash and PowerShell are not listed as skills.",
      projects: [5, 8], seen: ["Python"],
    },
    {
      id: "frontend", name: "Front end and web development", status: "yes",
      aliases: ["front end", "frontend", "front end development", "ui", "web development", "web dev", "full stack", "fullstack", "web application", "web applications", "web app", "web apps"],
      weak: ["ui", "web application", "web applications", "web app", "web apps"],
      proof: "In TalentMatch Pro he worked across the full stack and connected the front end to the real API. React is part of the capstone stack, and LayerLens has a plain JavaScript front end.",
      projects: [1, 3, 6], seen: ["full stack", "front end", "Plain JavaScript, HTML and CSS in the browser"],
    },
    {
      id: "html-css", name: "HTML and CSS", status: "part",
      aliases: ["html", "css", "html5", "css3"],
      proof: "LayerLens uses plain HTML, CSS and JavaScript in the browser, with no framework. HTML and CSS are not listed as separate skills.",
      projects: [3], seen: ["Plain JavaScript, HTML and CSS in the browser"],
    },
    {
      id: "css-tools", name: "CSS frameworks", status: "no", group: true,
      aliases: ["sass", "tailwind", "bootstrap"],
      near: "LayerLens uses plain HTML and CSS, and TalentMatch Pro has front-end work. No CSS framework is listed.",
      projects: [3, 6], seen: ["Plain JavaScript, HTML and CSS in the browser", "front end"],
    },

    // ---------- working with people ----------
    {
      id: "teamwork", name: "Teamwork", status: "yes",
      aliases: ["teamwork", "team work", "team player", "collaboration", "collaborative", "working in a team", "worked in a team", "work in a team", "worked in teams", "work in teams", "team setting", "team based", "team environment", "team projects"],
      weak: ["collaboration", "collaborative"],
      proof: "Five of his projects are team projects: the capstone, the ARP assignment (six people), the retail system (team of three), TalentMatch Pro and the loan model.",
      projects: [1, 5, 6, 7, 8], seen: ["Team capstone", "six-person", "team of three", "team project"],
    },
    {
      id: "leadership", name: "Leadership", status: "no",
      aliases: ["leadership", "team lead", "team leader", "led a team", "lead a team", "leading a team", "led teams", "managed a team", "manage a team", "people management", "line management", "mentoring"],
      weak: ["leadership", "mentoring"],
      proof: "In team projects he owned parts of the work, such as the Product and Inventory services in the retail system. The site does not describe a lead role.",
      projects: [7], seen: ["Product and Inventory services"],
    },
    {
      id: "spoken-languages", name: "Spoken languages", status: "no",
      aliases: ["speak", "speaks", "spoken", "english", "fluent", "fluency", "bilingual", "multilingual", "native language", "first language", "mother tongue", "language skills"],
      weak: ["speak", "speaks", "spoken", "english", "fluent", "fluency"],
      proof: "The site is written in English. It does not list the languages he speaks.",
      projects: [], seen: ["Hasibur Rahaman Hamim"],
    },
    {
      id: "documentation", name: "Documentation and write-ups", status: "yes",
      aliases: ["documentation", "technical writing", "technical documentation", "writing", "write ups", "writeups", "write up", "case studies", "case study", "knowledge base"],
      weak: ["documentation", "writing", "write up", "write ups"],
      proof: "Each security project has a written case study, the Active Directory lab is documented on GitHub, and the LayerLens repository has a threat model and a test record.",
      projects: [1, 3, 4, 5], seen: ["case study", "documented", "Threat model", "Test record"],
    },
    {
      id: "report-writing", name: "Report writing", status: "part",
      aliases: ["report writing", "pentest report", "pentest reports", "penetration test report", "penetration testing report", "security report", "security reports", "reporting"],
      weak: ["reporting"],
      proof: "The case studies read like short reports, with a problem, a result and a list of limits. No penetration test style report is on the site yet.",
      projects: [1, 3, 4, 5], seen: ["What it does not do"],
    },
    {
      id: "presentation", name: "Presentations", status: "yes",
      aliases: ["presentation", "presentations", "presenting"],
      proof: "He took the loan default results through to a 19-slide presentation.",
      projects: [8], seen: ["19-slide presentation"],
    },
    {
      id: "communication", name: "Communication", status: "part",
      aliases: ["communication", "communication skills", "written communication", "verbal communication", "interpersonal"],
      proof: "Shown by the written case studies and a 19-slide presentation. The site has no customer-facing examples.",
      projects: [8], seen: ["19-slide presentation"],
    },
    {
      id: "soft-skills", name: "Soft skills", status: "part", group: true,
      aliases: ["problem solving", "attention to detail", "time management", "adaptability", "self motivated", "self starter", "initiative", "analytical", "analytical skills", "critical thinking", "curiosity", "eager to learn", "willingness to learn", "fast learner", "quick learner"],
      proof: "The site does not list this as a skill. The case studies show how he works: he builds it, tests it and writes down what it does not do.",
      projects: [1, 3, 4, 5], seen: ["What it does not do"],
    },
    {
      id: "customer-service", name: "Customer service", status: "no", group: true,
      aliases: ["customer service", "customer support", "customer facing", "retail experience", "front line", "hospitality", "customer", "customers"],
      weak: ["front line", "hospitality", "customer", "customers"],
      near: "He works part-time as a team member at Coles Group and worked at United Petroleum. The site does not describe the duties.",
      projects: [], seen: ["Coles Group", "United Petroleum"],
    },
    {
      id: "user-management", name: "User account management", status: "part",
      aliases: ["user management", "user accounts", "user account management", "account management", "user administration"],
      proof: "The lab domain has users and a service account. No help desk account tasks are described.",
      projects: [4], seen: ["Users, a service account"],
    },
    {
      id: "troubleshooting", name: "Troubleshooting", status: "part",
      aliases: ["troubleshooting", "diagnostics", "fault finding"],
      proof: "He holds the Google Technical Support Fundamentals certificate. The site has no troubleshooting examples.",
      projects: [], seen: ["Google Technical Support Fundamentals"],
    },

    // ---------- where, when and the right to work ----------
    {
      id: "location", name: "Location", status: "yes", terminalOnly: true,
      aliases: ["wollongong", "sydney", "nsw", "new south wales"],
      proof: "Based in Wollongong, NSW. Open to roles in Wollongong and Sydney.",
      projects: [], seen: ["Wollongong", "Sydney"],
    },
    {
      id: "remote", name: "Remote work and relocation", status: "no", group: true, terminalOnly: true,
      aliases: ["remote", "remote work", "hybrid", "work from home", "wfh", "relocation", "relocate", "relocating"],
      weak: ["remote", "hybrid"],
      proof: "The site does not say whether he is open to remote work or relocating. Please ask him on LinkedIn.",
      projects: [], seen: ["Wollongong"],
    },
    {
      id: "start-date", name: "Start date", status: "no", group: true, terminalOnly: true,
      aliases: ["start date", "available to start", "availability", "available", "notice period", "immediate start", "immediately"],
      weak: ["availability", "available", "immediately"],
      proof: "He graduates in December 2026. The site does not give a start date.",
      projects: [], seen: ["Dec 2026"],
    },
    {
      id: "work-rights", name: "Work rights and clearance", status: "no", group: true, terminalOnly: true,
      aliases: ["citizen", "citizenship", "australian citizen", "permanent resident", "work rights", "right to work", "visa", "sponsorship", "security clearance", "clearance", "baseline clearance", "nv1", "nv2", "agsva"],
      proof: "The site does not state work rights or clearance. Type rights to see how to ask.",
      projects: [], seen: ["Wollongong"],
    },
  ];

  const LABELS = { yes: "shown", part: "partly", learn: "learning", no: "not shown" };
  const SAYINGS = { yes: "shown on the site", part: "partly shown on the site", learn: "he is learning this", no: "not shown on the site" };
  const DEFAULT_NO = "It is not mentioned on this site.";
  const MAX_ITEMS = 10; // how many requirements one check will look at
  const PROSE_WORDS = 6; // a piece with more words than this is read as a sentence
  const PROSE_WORDS_QUESTION = 9; // questions are longer, so they get a bit more room
  const MAX_QUESTION_ITEMS = 4;

  // four pages have a case study. Skills point to them through the project number.
  const CASE_PAGES = {
    1: ["Capstone case study", "upload-scanner.html"],
    3: ["LayerLens case study", "layerlens.html"],
    4: ["Active Directory lab case study", "ad-lab.html"],
    5: ["ARP detector case study", "arp-detector.html"],
  };

  const YEARS = /\b\d+\s*\+?\s*(?:years?|yrs?)\b(?:\s+of)?(?:\s+experience)?/i;

  // words that carry no requirement of their own, like "experience with"
  const FILLER = new Set(
    ("a an the of in on for to with and or plus as at by from is are be been being into per any some such like it " +
      "experience experienced knowledge knowledgeable skills skill skilled familiarity familiar understanding strong good great solid basic basics " +
      "working work hands hand proficiency proficient ability able abilities expertise background exposure using use used required requirement requirements " +
      "preferred desirable must have has should nice bonus fit check tools tool technologies technology platforms platform role roles position job candidate " +
      "eg ie etc").split(" ")
  );

  // lower case, letters and numbers only (plus + and #), one space between words
  function words(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
  }

  // every alias points to its entry, and the longest alias tells us how far to look ahead
  const byAlias = new Map();
  const weakAliases = new Set();
  const byCapsAlias = new Map();
  const byId = new Map();
  let longest = 1;
  ENTRIES.forEach(function (entry) {
    byId.set(entry.id, entry);
    entry.aliases.forEach(function (alias) {
      const key = words(alias);
      byAlias.set(key, entry);
      longest = Math.max(longest, key.split(" ").length);
    });
    (entry.weak || []).forEach(function (alias) {
      weakAliases.add(words(alias));
    });
    (entry.capsOnly || []).forEach(function (alias) {
      byCapsAlias.set(words(alias), entry);
    });
  });

  function findAlias(key, inSentence) {
    const entry = byAlias.get(key);
    if (!entry) return null;
    if (inSentence && weakAliases.has(key)) return null;
    return entry;
  }

  // "pcaps" finds "pcap" too
  function lookup(phrase, inSentence) {
    const direct = findAlias(phrase, inSentence);
    if (direct) return direct;
    const parts = phrase.split(" ");
    const last = parts[parts.length - 1];
    if (last.length > 3 && last.endsWith("s")) {
      parts[parts.length - 1] = last.slice(0, -1);
      return findAlias(parts.join(" "), inSentence);
    }
    return null;
  }

  // how many single-letter edits turn word a into word b (for typos)
  function distance(a, b) {
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = row;
    }
    return prev[b.length];
  }

  // A word that is almost right, like "wireshrk". It is only a suggestion, never an answer.
  function suggest(word) {
    const text = word.toLowerCase();
    if (text.length < 5 || text.indexOf(" ") !== -1) return null;
    const allowed = text.length >= 9 ? 2 : 1;
    let best = null;
    let bestScore = allowed + 1;
    byAlias.forEach(function (entry, alias) {
      if (entry.status === "no" || alias.length < 5 || alias.indexOf(" ") !== -1) return;
      if (Math.abs(alias.length - text.length) > allowed) return;
      const score = distance(text, alias);
      if (score > 0 && score < bestScore) {
        best = alias;
        bestScore = score;
      }
    });
    return best;
  }

  function describe(entry) {
    if (entry.status !== "no" || entry.proof) return entry.proof;
    return entry.near ? "Closest on the site: " + entry.near : DEFAULT_NO;
  }

  // keeps the words the visitor typed, but drops odd symbols between them
  function cleanKey(text) {
    return text.replace(/[^A-Za-z0-9+#.&\-\/ ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  }

  function makeItem(entry, typed) {
    return {
      key: typed,
      id: entry.id,
      name: entry.group ? typed : entry.name,
      group: Boolean(entry.group),
      status: entry.status,
      label: entry.label || LABELS[entry.status],
      detail: describe(entry),
      asked: entry.asked || null,
      projects: entry.projects || [],
      terminalOnly: Boolean(entry.terminalOnly),
      unknown: false,
    };
  }

  function unknownItem(typed) {
    const close = suggest(typed);
    return {
      key: typed,
      id: null,
      name: typed,
      group: false,
      status: "no",
      label: LABELS.no,
      detail: close ? DEFAULT_NO + " Did you mean " + close + "?" : DEFAULT_NO,
      asked: null,
      projects: [],
      terminalOnly: false,
      unknown: true,
      suggest: close,
    };
  }

  // Reads one piece of the list (the text between commas) and adds what it finds, in order.
  function scanPiece(piece, found, state, proseLimit) {
    let text = piece;
    const years = text.match(YEARS);
    if (years) {
      found.push(makeItem(byId.get("level-years"), cleanKey(years[0])));
      text = text.replace(YEARS, " ");
    }

    // the words in this piece, with their positions so the original spelling can be shown
    const tokens = [];
    const pattern = /[A-Za-z0-9+#]+/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      tokens.push({ text: match[0], lower: match[0].toLowerCase(), start: match.index, end: match.index + match[0].length });
    }
    if (tokens.length === 0) return;
    const inSentence = tokens.length > proseLimit;

    let unknown = []; // words in a row that nothing matched
    function flush() {
      if (unknown.length > 0) {
        if (inSentence) state.sentence = true;
        else found.push(unknownItem(cleanKey(text.slice(unknown[0].start, unknown[unknown.length - 1].end))));
      }
      unknown = [];
    }

    let i = 0;
    while (i < tokens.length) {
      // try the longest phrase first, then shorter ones
      let entry = null;
      let size = 0;
      for (let n = Math.min(longest, tokens.length - i); n >= 1 && !entry; n--) {
        const phrase = tokens.slice(i, i + n).map(function (t) { return t.lower; }).join(" ");
        entry = lookup(phrase, inSentence);
        if (entry) size = n;
      }
      if (!entry && tokens[i].text === "IT") {
        entry = byCapsAlias.get("it") || null;
        size = 1;
      }

      if (entry) {
        flush();
        found.push(makeItem(entry, cleanKey(text.slice(tokens[i].start, tokens[i + size - 1].end))));
        i += size;
        continue;
      }

      const word = tokens[i].lower;
      if (word === "and" || word === "or") {
        flush(); // "docker and kubernetes" are two things
      } else if (!FILLER.has(word) && word.length > 1 && !/^\d+$/.test(word)) {
        unknown.push(tokens[i]);
      }
      i++;
    }
    flush();
  }

  // Checks a list of requirements such as "SOC analyst, Python, Splunk".
  function check(text, options) {
    const raw = String(text === undefined || text === null ? "" : text).slice(0, 300);
    const proseLimit = options && options.question ? PROSE_WORDS_QUESTION : PROSE_WORDS;
    const found = [];
    const state = { sentence: false };
    raw.split(String.fromCharCode(8226)).join(",").split(/[,;|\n\r]+/).forEach(function (piece) {
      scanPiece(piece, found, state, proseLimit);
    });

    // the same thing typed twice is shown once
    const seen = new Set();
    const items = found.filter(function (item) {
      const key = item.key.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const shown = items.slice(0, MAX_ITEMS);
    const counts = { yes: 0, part: 0, learn: 0, no: 0 };
    shown.forEach(function (item) {
      counts[item.status]++;
    });
    return { items: shown, counts: counts, clipped: items.length > MAX_ITEMS, sentence: state.sentence };
  }

  // ---------- questions such as "does he know Splunk?" ----------

  // words that show the question is about a skill or a tool
  const ASKING = [
    "know", "knows", "knowledge", "use", "uses", "used", "using", "experience", "experienced", "familiar", "familiarity",
    "proficient", "proficiency", "skilled", "skills", "skill", "comfortable", "capable", "competent", "touched", "tried",
    "learned", "learnt", "studied", "trained", "certified", "hands on", "worked with", "work with", "works with",
    "working with", "code in", "program in", "background in",
    // other ways of asking whether he has something or has done something
    "have", "has", "had", "got", "done any", "done much", "performed", "conducted", "carried out",
    "working towards", "working toward", "studying for", "preparing for", "pursuing",
    "worked in", "work in", "working in", "led", "leading", "managed", "speak", "speaks", "spoken", "fluent",
    // questions about how strong he is
    "good at", "good with", "how good", "how well", "strong in", "strong at", "expert", "expertise", "advanced",
  ];

  // Questions about his level or how long he has used something. The site does not give either,
  // so the answer says so instead of leaving the visitor to think the first line is a rating.
  const LEVEL = [
    "how good", "how well", "good at", "good with", "strong", "expert", "expertise", "level", "advanced",
    "proficient", "proficiency", "skilled", "how many years", "years of experience", "years experience", "how long",
  ];

  // Questions about why he chose something, or what drew him to it, are not skill questions.
  // They go to the normal search, which says that the site does not give his reasons.
  const MOTIVE = [
    "why", "got him into", "get into", "got into", "drew him", "attracted him", "inspired", "inspires",
    "made him", "makes him", "interested him", "interests him",
  ];

  // everyday words in a question. They are not mistaken for a skill that the list does not know.
  const QUESTION_WORDS = new Set(
    ("does do did is are was were has have had got he his him hamim candidate she her they their " +
      "any anything some something much many more most very really well also too even ever still yet already just only " +
      "can could would should will may might shall how what which who whom whose when where why whether if " +
      "know knows known use uses using used worked work works working studied trained learned learnt tried touched " +
      "familiar comfortable capable competent certified level years year months month little lot lots bit few several " +
      "both either each every all one two three about around over under between through into near " +
      "not no yes please tell me us we you your i my it its this that these those there here " +
      "other others another such kind kinds type types sort sorts like than then so but because since while " +
      "done make made build built create created develop developed write wrote written run ran running " +
      "speak speaks spoken fluent led leading managed performed conducted carried " +
      "good great strong solid deep basic basics high low new old own real actual actually truly " +
      "ask asked asking say says said mention mentioned list listed show shown shows see seen worth able ability abilities " +
      "language languages towards toward against across among within without during after before until upon via per " +
      "role roles job jobs company team teams").split(" ")
  );
  const ABOUT_HIM = ["he", "hamim", "his", "him", "candidate"];
  const ABOUT_THE_SITE = ["you", "your", "assistant", "chatbot", "bot", "site", "website", "page", "terminal", "this"];
  // a question about his projects is better answered from the project facts than from the skills list
  const ABOUT_PROJECTS = ["project", "projects", "built", "build", "builds", "made", "created", "developed", "wrote"];

  // "A", "A and B", "A, B and C"
  function joinNames(list) {
    return list.length < 2 ? list[0] : list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  // so a line starts with a capital letter, even if the visitor typed "splunk"
  function capital(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // true when the word has "and", "or", a comma or a slash right next to it
  function nextToJoiner(joined, word) {
    return [" and ", " or ", " , ", " / "].some(function (mark) {
      return joined.indexOf(mark + word + " ") !== -1 || joined.indexOf(" " + word + mark) !== -1;
    });
  }

  function hasAny(padded, list) {
    return list.some(function (word) {
      return padded.indexOf(" " + word + " ") !== -1;
    });
  }

  // Returns { lines, ids, projects, names } when the question is about what he knows or has used
  // and the list recognises it. Returns null for anything else, so the normal topic search can answer.
  // With fallback set, any recognised skill counts, even if the question is not worded as a skill question.
  function answerQuestion(question, options) {
    const text = String(question === undefined || question === null ? "" : question).slice(0, 300);
    const padded = " " + words(text) + " ";
    const count = padded.trim() === "" ? 0 : padded.trim().split(" ").length;
    if (count === 0 || count > 30) return null;

    if (!(options && options.fallback)) {
      if (!hasAny(padded, ASKING)) return null;
      if (hasAny(padded, MOTIVE)) return null;
      if (hasAny(padded, ABOUT_PROJECTS)) return null;
      const aboutHim = hasAny(padded, ABOUT_HIM);
      if (!aboutHim && (count > 6 || hasAny(padded, ABOUT_THE_SITE))) return null;
    }

    // the question with commas and slashes kept as separate marks, to see which words sit in a list
    const joined = " " + text.toLowerCase().replace(/[^a-z0-9+#,\/]+/g, " ").replace(/([,\/])/g, " $1 ").replace(/\s+/g, " ") + " ";

    // one answer for each entry. Names that share an entry, like Security+ and OSCP, share the answer.
    const items = [];
    let leftover = false; // true when the question names something the list does not know
    check(text, { question: true }).items.forEach(function (item) {
      if (item.unknown) {
        const rest = words(item.key).split(" ").filter(function (w) {
          return w.length > 1 && !/^\d+$/.test(w) && !QUESTION_WORDS.has(w) && !FILLER.has(w);
        });
        if (rest.some(function (w) { return nextToJoiner(joined, w); })) leftover = true;
        return;
      }
      if (item.terminalOnly) return;
      const same = items.find(function (other) { return other.id === item.id; });
      if (!same) {
        items.push(Object.assign({}, item, { typed: [item.key] }));
      } else if (same.typed.indexOf(item.key) === -1 && same.typed.length < 3) {
        same.typed.push(item.key);
      }
    });
    if (items.length === 0 || items.length > MAX_QUESTION_ITEMS) return null;

    const lines = items.map(function (item) {
      const name = capital(item.group ? joinNames(item.typed) : item.name);
      if (item.asked) return name + ": " + item.asked;
      return name + ": " + SAYINGS[item.status] + ". " + item.detail;
    });
    const shownSomething = items.some(function (item) { return item.status === "yes" || item.status === "part"; });
    if (shownSomething && hasAny(padded, LEVEL)) {
      lines.push("The site does not rate his level or say how long he has used it. It only shows where he has used it.");
    }
    if (leftover) lines.push("I did not recognise every term in your question, so only the items above were checked.");
    if (items.some(function (item) { return item.status === "no"; })) {
      lines.push("Not shown only means the site does not mention it. LinkedIn is the best place to ask him.");
    } else if (leftover) {
      lines.push("LinkedIn is the best place to ask him about anything else.");
    }

    const projects = [];
    items.forEach(function (item) {
      item.projects.forEach(function (n) {
        if (projects.indexOf(n) === -1) projects.push(n);
      });
    });
    return {
      lines: lines,
      ids: items.map(function (item) { return item.id; }),
      names: items.map(function (item) { return capital(item.group ? joinNames(item.typed) : item.name); }),
      statuses: items.map(function (item) { return item.status; }),
      projects: projects.sort(function (a, b) { return a - b; }),
    };
  }

  // the case study pages for some project numbers, as [label, address] pairs (at most two)
  function casePages(projectNumbers) {
    const pages = [];
    projectNumbers.forEach(function (n) {
      if (CASE_PAGES[n] && pages.length < 2) pages.push(CASE_PAGES[n]);
    });
    return pages;
  }

  return {
    ENTRIES: ENTRIES,
    LABELS: LABELS,
    CASE_PAGES: CASE_PAGES,
    MAX_ITEMS: MAX_ITEMS,
    check: check,
    answerQuestion: answerQuestion,
    casePages: casePages,
    words: words,
  };
});
