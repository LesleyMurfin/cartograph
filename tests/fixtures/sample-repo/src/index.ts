import { helper, VALUE } from "./util";
import "./side-effect";
import lodash from "lodash";
import { helper as aliased } from "@/util";

export { helper } from "./util";
export * from "./util";

const dynamic = import("./util");
const req = require("./util");

void helper;
void VALUE;
void aliased;
void lodash;
void dynamic;
void req;

// deliberately broken local import — Fail-Loud
import { missing } from "./does-not-exist";
void missing;
