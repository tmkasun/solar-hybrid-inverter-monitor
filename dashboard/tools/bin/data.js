import * as fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Use JSON file for storage
const file = join(__dirname, "..", "data", "stations2.json");
const file2 = join(__dirname, "..", "data", "stations.json");
const validRecords = [];
const invalidRecords = [];
const { posts } = JSON.parse(fs.readFileSync(file, "utf8"));
const post2 = JSON.parse(fs.readFileSync(file2, "utf8"));
let validCount = 0;
let invalidCount = 0;
const ids = new Set();
for (const post of [...posts, ...post2.posts]) {
    const { id } = post;
    if (id !== 0) {
        if (ids.has(id)) {
            console.log(`Duplicate id: ${id}`);
        }
        else {
            validCount += 1;
            validRecords.push(post);
        }
        ids.add(id);
    }
    else {
        invalidCount += 1;
        invalidRecords.push(post);
    }
}
console.log(`Valid records: ${validCount} and invalid records: ${invalidCount}`);
console.log(`total records: ${validCount + invalidCount} vs ${posts.length}`);
const allData = JSON.stringify(validRecords);
const finalFile = join(__dirname, "..", "data", "final.json");
fs.writeFileSync(finalFile, allData);
debugger;
//# sourceMappingURL=data.js.map