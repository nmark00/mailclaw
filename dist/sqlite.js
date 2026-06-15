"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteDatabase = void 0;
const node_fs_1 = require("node:fs");
const node_sqlite_1 = require("node:sqlite");
function normalizeParams(params) {
    if (params === undefined)
        return [];
    return Array.isArray(params) ? params : [params];
}
// Mail's Envelope Index uses 64-bit integers (iCloud row IDs) that exceed JS safe range.
// Convert BigInt to number when in range, otherwise string.
function normalizeBigInts(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'bigint') {
            out[k] = v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER)
                ? Number(v)
                : v.toString();
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
class SQLiteStatement {
    statement;
    constructor(statement) {
        this.statement = statement;
        this.statement.setReadBigInts(true);
    }
    all(params) {
        return this.statement.all(...normalizeParams(params)).map(normalizeBigInts);
    }
    get(params) {
        const row = this.statement.get(...normalizeParams(params));
        return row ? normalizeBigInts(row) : undefined;
    }
}
class SQLiteDatabase {
    database;
    constructor(filePath, options = {}) {
        if (options.fileMustExist && !(0, node_fs_1.existsSync)(filePath)) {
            throw new Error(`Database file does not exist: ${filePath}`);
        }
        this.database = new node_sqlite_1.DatabaseSync(filePath, {
            readOnly: options.readonly ?? false
        });
        this.database.exec(`PRAGMA busy_timeout = ${options.timeout ?? 2000}`);
    }
    prepare(sql) {
        return new SQLiteStatement(this.database.prepare(sql));
    }
    close() {
        this.database.close();
    }
}
exports.SQLiteDatabase = SQLiteDatabase;
