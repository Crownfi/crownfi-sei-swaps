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
				"./styles/main.css"
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
					test: /\.html$/i,
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
			})
		],
		optimization: {
			minimizer: [`...`, new CssMinimizerPlugin()],
		},
	};
	config.mode = argv.mode;

	return config;
};
