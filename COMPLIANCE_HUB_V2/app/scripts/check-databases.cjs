const PROJECT_ID = 'compliance-hub-br';

async function listDatabases() {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

listDatabases().catch(console.error);
