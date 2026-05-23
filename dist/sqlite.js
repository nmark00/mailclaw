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
class SQLiteStatement {
    statement;
    constructor(statement) {
        this.statement = statement;
    }
    all(params) {
        return this.statement.all(...normalizeParams(params));
    }
    get(params) {
        return this.statement.get(...normalizeParams(params));
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
