import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface CertificateOptions {
  certPath?: string;
  keyPath?: string;
  caCertPath?: string;
  caKeyPath?: string;
  validity?: number;
  commonName?: string;
}

const DEFAULT_OPTIONS: Required<CertificateOptions> = {
  certPath: path.join(process.cwd(), "certs", "cert.pem"),
  keyPath: path.join(process.cwd(), "certs", "key.pem"),
  caCertPath: path.join(process.cwd(), "certs", "ca-cert.pem"),
  caKeyPath: path.join(process.cwd(), "certs", "ca-key.pem"),
  validity: 365,
  commonName: "localhost"
};

export function generateSelfSignedCertificate(options: CertificateOptions = {}): { cert: string; key: string; ca?: string } {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Ensure certificates directory exists
  const certsDir = path.dirname(config.certPath);
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  // Check if certificates already exist
  if (fs.existsSync(config.certPath) && fs.existsSync(config.keyPath)) {
    console.log("Using existing SSL certificates");
    const result: { cert: string; key: string; ca?: string } = {
      cert: config.certPath,
      key: config.keyPath,
    };
    if (fs.existsSync(config.caCertPath)) {
      result.ca = config.caCertPath;
    }
    return result;
  }

  console.log("Generating self-signed SSL certificates...");

  try {
    // Generate a private key
    execSync(`openssl genrsa -out "${config.keyPath}" 2048`, { stdio: "ignore" });

    // Generate a certificate signing request (CSR)
    const subj = `/C=US/ST=State/L=City/O=Organization/CN=${config.commonName}`;
    execSync(
      `openssl req -new -key "${config.keyPath}" -out "${certsDir}/csr.pem" -subj "${subj}"`,
      { stdio: "ignore" }
    );

    // Create a config file for certificate extensions
    const extFile = path.join(certsDir, "v3.ext");
    const extContent = `
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = [::1]
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = 0.0.0.0
`;
    fs.writeFileSync(extFile, extContent);

    // Generate the self-signed certificate
    execSync(
      `openssl x509 -req -in "${certsDir}/csr.pem" -signkey "${config.keyPath}" -out "${config.certPath}" -days ${config.validity} -extfile "${extFile}"`,
      { stdio: "ignore" }
    );

    // Clean up temporary files
    fs.unlinkSync(path.join(certsDir, "csr.pem"));
    fs.unlinkSync(extFile);

    console.log("SSL certificates generated successfully");
    console.log(`Certificate: ${config.certPath}`);
    console.log(`Private key: ${config.keyPath}`);

    return {
      cert: config.certPath,
      key: config.keyPath
    };
  } catch (error) {
    console.error("Failed to generate SSL certificates:", error);
    console.log("Make sure OpenSSL is installed on your system");
    throw new Error("Certificate generation failed");
  }
}

export function loadCertificates(options: CertificateOptions = {}) {
  const paths = generateSelfSignedCertificate(options);
  
  const result: { cert: Buffer; key: Buffer; ca?: Buffer } = {
    cert: fs.readFileSync(paths.cert),
    key: fs.readFileSync(paths.key),
  };
  
  if (paths.ca) {
    result.ca = fs.readFileSync(paths.ca);
  }
  
  return result;
}
