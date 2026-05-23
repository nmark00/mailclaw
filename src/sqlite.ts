import { existsSync } from 'node:fs';
import { DatabaseSync, StatementSync } from 'node:sqlite';

interface SQLiteOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
}

type SQLiteParam = string | number | bigint | null | Buffer;
type SQLiteRow = Record<string, unknown>;

function normalizeParams(params?: SQLiteParam[] | SQLiteParam): SQLiteParam[] {
    if (params === undefined) return [];
    return Array.isArray(params) ? params : [params];
}

class SQLiteStatement {
    constructor(private readonly statement: StatementSync) { }

    all(params?: SQLiteParam[] | SQLiteParam): SQLiteRow[] {
        return this.statement.all(...normalizeParams(params)) as SQLiteRow[];
    }

    get(params?: SQLiteParam[] | SQLiteParam): SQLiteRow | undefined {
        return this.statement.get(...normalizeParams(params)) as SQLiteRow | undefined;
    }
}

export class SQLiteDatabase {
    private readonly database: DatabaseSync;

    constructor(filePath: string, options: SQLiteOptions = {}) {
        if (options.fileMustExist && !existsSync(filePath)) {
            throw new Error(`Database file does not exist: ${filePath}`);
        }

        this.database = new DatabaseSync(filePath, {
            readOnly: options.readonly ?? false
        });
        this.database.exec(`PRAGMA busy_timeout = ${options.timeout ?? 2000}`);
    }

    prepare(sql: string): SQLiteStatement {
        return new SQLiteStatement(this.database.prepare(sql));
    }

    close() {
        this.database.close();
    }
}
