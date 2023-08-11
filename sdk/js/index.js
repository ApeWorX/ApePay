"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stream = void 0;
var viem_1 = require("viem");
var StreamManager_json_1 = require("../../.build/StreamManager.json");
var Stream = /** @class */ (function () {
    function Stream(address, creator, streamId, publicClient, walletClient) {
        this.address = address;
        this.creator = creator;
        this.streamId = streamId;
        this.publicClient = publicClient;
        this.walletClient = walletClient;
    }
    Stream.prototype.timeLeft = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = Number;
                        return [4 /*yield*/, this.publicClient.readContract({
                                address: this.address,
                                abi: StreamManager_json_1.default.abi,
                                functionName: "time_left",
                                args: [this.creator, this.streamId],
                            })];
                    case 1: return [2 /*return*/, _a.apply(void 0, [(_b.sent())])];
                }
            });
        });
    };
    Stream.prototype.streamInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.publicClient.readContract({
                            address: this.address,
                            abi: StreamManager_json_1.default.abi,
                            functionName: "streams",
                            args: [this.creator, this.streamId],
                        })];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    Stream.prototype.token = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.streamInfo()];
                    case 1: return [2 /*return*/, (_a.sent()).token];
                }
            });
        });
    };
    Stream.prototype.totalTime = function () {
        return __awaiter(this, void 0, void 0, function () {
            var streamInfo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.streamInfo()];
                    case 1:
                        streamInfo = _a.sent();
                        return [2 /*return*/, (Number(streamInfo.funded_amount / streamInfo.amount_per_second) +
                                Number(streamInfo.last_pull - streamInfo.start_time))];
                }
            });
        });
    };
    return Stream;
}());
exports.Stream = Stream;
var StreamManager = /** @class */ (function () {
    function StreamManager(address, publicClient, walletClient) {
        this.address = address;
        this.publicClient = publicClient;
        this.walletClient = walletClient;
    }
    StreamManager.prototype.owner = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.publicClient.readContract({
                            address: this.address,
                            abi: StreamManager_json_1.default.abi,
                            functionName: "owner",
                        })];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    StreamManager.prototype.isAccepted = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.publicClient.readContract({
                            address: this.address,
                            abi: StreamManager_json_1.default.abi,
                            functionName: "token_is_accepted",
                            args: [token],
                        })];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    StreamManager.prototype.MIN_STREAM_LIFE = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = Number;
                        return [4 /*yield*/, this.publicClient.readContract({
                                address: this.address,
                                abi: StreamManager_json_1.default.abi,
                                functionName: "MIN_STREAM_LIFE",
                            })];
                    case 1: return [2 /*return*/, _a.apply(void 0, [(_b.sent())])];
                }
            });
        });
    };
    StreamManager.prototype.create = function (token, amountPerSecond, reason, startTime, accountOverride) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function () {
            var account, args, streamId, _f, hash;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        if (!accountOverride && !((_a = this.walletClient) === null || _a === void 0 ? void 0 : _a.account))
                            throw new Error("No account");
                        account = accountOverride || ((_d = (_c = (_b = this.walletClient) === null || _b === void 0 ? void 0 : _b.account) === null || _c === void 0 ? void 0 : _c.address) !== null && _d !== void 0 ? _d : "0x0");
                        args = [token, amountPerSecond];
                        if (startTime) {
                            args.push(reason ? (0, viem_1.stringToHex)(reason) : ""); // NOTE: Needs to make sure to have 4 args
                            args.push(startTime);
                        }
                        else if (reason) {
                            args.push((0, viem_1.stringToHex)(reason));
                        }
                        _f = Number;
                        return [4 /*yield*/, this.publicClient.readContract({
                                address: this.address,
                                abi: StreamManager_json_1.default.abi,
                                functionName: "num_streams",
                                args: [account],
                            })];
                    case 1:
                        streamId = _f.apply(void 0, [(_g.sent())]);
                        return [4 /*yield*/, ((_e = this.walletClient) === null || _e === void 0 ? void 0 : _e.writeContract({
                                chain: null,
                                address: this.address,
                                abi: StreamManager_json_1.default.abi,
                                functionName: "create_stream",
                                args: args,
                                account: account,
                            }))];
                    case 2:
                        hash = _g.sent();
                        if (hash === undefined)
                            throw new Error("Error while processing trasactions");
                        return [2 /*return*/, new Stream(this.address, account, streamId, this.publicClient, this.walletClient)];
                }
            });
        });
    };
    StreamManager.prototype.onStreamCreated = function (handleStream, creator) {
        var _this = this;
        var onLogs = function (logs) {
            logs
                .map(
            // Log is StreamCreated
            function (log) {
                return new Stream(log.address, 
                // @ts-ignore
                log.topics[2], // creator
                // @ts-ignore
                Number(log.topics[3]), // streamId
                _this.publicClient, _this.walletClient);
            })
                .forEach(handleStream);
        };
        this.publicClient.watchContractEvent({
            address: this.address,
            abi: StreamManager_json_1.default.abi,
            eventName: "StreamCreated",
            args: creator ? { creator: creator } : {},
            onLogs: onLogs,
        });
    };
    return StreamManager;
}());
exports.default = StreamManager;
