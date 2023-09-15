import {Config} from "./astroport_deploy_interfaces"
import { readArtifact } from "../helpers";

export const chainConfigs: Config = readArtifact(`${process.env.CHAIN_ID || "localsei"}`, 'chain_configs');
