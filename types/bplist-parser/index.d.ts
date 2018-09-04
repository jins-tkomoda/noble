export var maxObjectSize: number;
export var maxObjectCount: number;

export declare function UID(id: number): void;
declare namespace f {
    export var UID: number;
}

export declare function parseFile(fileNameOrBuffer: string | Buffer, callback?: (error: Error, obj?: any[]) => void): void;
export declare function parseBuffer(buffer: Buffer): any[];
