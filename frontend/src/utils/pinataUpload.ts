const PINATA_API = "https://api.pinata.cloud";

function getJWT(): string {
  const jwt = import.meta.env.VITE_PINATA_JWT as string;
  if (!jwt) throw new Error("VITE_PINATA_JWT not set in .env");
  return jwt;
}

export async function isSeedAlreadyMinted(seed: number): Promise<boolean> {
  const name = `space-invader-metadata-seed-${seed}`;
  const res = await fetch(
    `${PINATA_API}/data/pinList?metadata[name]=${encodeURIComponent(name)}&status=pinned`,
    { headers: { Authorization: `Bearer ${getJWT()}` } }
  );
  if (!res.ok) return false;
  const data = await res.json();
  return data.count > 0;
}

export async function pinFile(blob: Blob, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", blob, name);
  form.append("pinataMetadata", JSON.stringify({ name }));

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getJWT()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata file upload failed: ${await res.text()}`);
  const data = await res.json();
  return data.IpfsHash as string;
}

export async function pinJSON(obj: object, name: string): Promise<string> {
  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getJWT()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pinataMetadata: { name }, pinataContent: obj }),
  });
  if (!res.ok) throw new Error(`Pinata JSON upload failed: ${await res.text()}`);
  const data = await res.json();
  return data.IpfsHash as string;
}
