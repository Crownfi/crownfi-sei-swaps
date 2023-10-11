const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = (env, argv) => {
	const config = {
		entry: {
			"main": ["./src/ts/entrypoint.ts", "./src/styling/main.css"]
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
