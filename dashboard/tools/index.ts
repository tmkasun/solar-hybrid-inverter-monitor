import fetch from "node-fetch";
import { join, dirname } from "path";
import { Low, JSONFile } from "lowdb";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Use JSON file for storage
const file = join(__dirname, "..", "db", "stations2.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);

// If file.json doesn't exist, db.data will be null
// Set default data
// db.data = db.data || { posts: [] } // Node < v15.x
const initData: { posts: Array<any> } = { posts: [] };
db.data ||= initData; // Node >= 15.x

// Alternatively, you can also use this syntax if you prefer
const { posts } = db.data as any;

async function main() {
  const requestOptions = {
    method: "GET",
  };

  let data;
  let count = 1000; // Last fetched station
  while (count < 1690) {
    count += 1;
    try {
      console.log(`Fetching ${count} data`);
      const response = await fetch(
        `https://fuel.gov.lk/api/v1/sheddetails/${count}`,
        requestOptions
      );
      data = await response.json();
    } catch (error) {
      console.log(`Error while getting ${count} data`);
      console.log(error);
    }
    if (data) {
      posts.push(data);
      console.log(`Inserted ${data.shedName}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
        console.log(`No data for ${count}`);
    }
  }

  // Finally write db.data content to file
  await db.write();
}

main();
