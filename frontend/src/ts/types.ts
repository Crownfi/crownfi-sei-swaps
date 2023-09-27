export interface ComponentPairInfo {
	/** Name of the pair */
	"name": string,
	/** Denom of the "left" token; "cw20/{address}" if cw20 */
	"token0": string,
	/** Denom of the "right" token; "cw20/{address}" if cw20 */
	"token1": string,
	/** address of the pool */
	"pool": string,
	/** address of the LP token (cw20) */
	"lpToken": string,
	/** address of the oracle */
	"oracle": string
}
