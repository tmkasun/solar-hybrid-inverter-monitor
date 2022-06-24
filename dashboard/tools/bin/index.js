var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const initData = { posts: [] };
db.data || (db.data = initData); // Node >= 15.x
// Alternatively, you can also use this syntax if you prefer
const { posts } = db.data;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const requestOptions = {
            method: "GET",
        };
        let data;
        let count = 1000; // Last fetched station
        while (count < 1690) {
            count += 1;
            try {
                console.log(`Fetching ${count} data`);
                const response = yield fetch(`https://fuel.gov.lk/api/v1/sheddetails/${count}`, requestOptions);
                data = yield response.json();
            }
            catch (error) {
                console.log(`Error while getting ${count} data`);
                console.log(error);
            }
            if (data) {
                posts.push(data);
                console.log(`Inserted ${data.shedName}`);
                yield new Promise((resolve) => setTimeout(resolve, 1000));
            }
            else {
                console.log(`No data for ${count}`);
            }
        }
        // Finally write db.data content to file
        yield db.write();
    });
}
main();
//# sourceMappingURL=index.js.map