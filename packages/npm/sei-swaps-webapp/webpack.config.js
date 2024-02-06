const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = (env, argv) => {
	const config = {
		entry: {
			"main": ["./src/entrypoint.ts", "./styles/main.css"]
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
					use: [MiniCssExtractPlugin.loader, "css-loader"]
				}
			],
		},
		output: {
			filename: "[name].js",
			path: path.resolve(__dirname, "dist", "bundles"),
		},
		resolve: {
			extensions: [".tsx", ".ts", ".js"],
			// I hate that TSC's decision to not support module import rewriting has knockoff effects like this
			extensionAlias: {
				'.js': ['.js', '.ts'],
			},
			fallback: {
				buffer: require.resolve("buffer-lite"),
				crypto: false,
			}
		},
		plugins: [
			new MiniCssExtractPlugin(),
			new webpack.ProvidePlugin({
				Buffer: ["buffer-lite", "Buffer"],
			}),
		],
		optimization: {
			minimizer: [
				`...`,
				new CssMinimizerPlugin(),
			],
		},
	};
	config.mode = argv.mode;

	return config;
};
