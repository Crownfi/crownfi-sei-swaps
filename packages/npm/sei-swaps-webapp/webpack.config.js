import { execSync } from "child_process";
import { glob } from "glob";
import { resolve as pathResolve } from "path";
import { fileURLToPath } from "url";
import webpack from "webpack";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import CssMinimizerPlugin from "css-minimizer-webpack-plugin";

const __dirname = import.meta.dirname;

export default (env, argv) => {
	const config = {
		entry: {
			main: [
				"./src/entrypoint.ts", 
				"./styles/main.css",
				...glob.sync("./src/**/template.html", { dotRelative: true })
			],
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					use: "ts-loader",
					exclude: /node_modules/,
				},
				{
					test: /\.css$/,
					use: [MiniCssExtractPlugin.loader, "css-loader"],
				},
				{
					test: /template\.html$/i,
					use: "html-loader"
				},
			],
		},
		output: {
			filename: "[name].js",
			path: pathResolve(__dirname, "dist", "bundles"),
		},
		resolve: {
			extensions: [".tsx", ".ts", ".js"],
			// I hate that TSC's decision to not support module import rewriting has knockoff effects like this
			extensionAlias: {
				".js": [".js", ".ts"],
			},
			fallback: {
				buffer: fileURLToPath(import.meta.resolve("buffer-lite")),
				crypto: false,
			},
		},
		plugins: [
			new MiniCssExtractPlugin(),
			new webpack.ProvidePlugin({
				Buffer: ["buffer-lite", "Buffer"],
			}),
			{
				apply: (compiler) => {
					compiler.hooks.watchRun.tap("WatchRun", () => {
						if (!compiler.modifiedFiles) return;

						if (Array.from(compiler.modifiedFiles).some(f => f.includes("template.html")))
							execSync("npm run codegen");
					});
				}
			}
		],
		optimization: {
			minimizer: [`...`, new CssMinimizerPlugin()],
		},
	};
	config.mode = argv.mode;

	return config;
};
