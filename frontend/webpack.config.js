const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
	mode: "development",
	entry: {
		"main": ["./src/ts/main.ts", "./src/css/main.css"]
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
		path: path.resolve(__dirname, "dist"),
	},
	resolve: {
		extensions: [".tsx", ".ts", ".js"],
		fallback: {
            buffer: require.resolve("buffer-lite"),
        }
	},
	plugins: [
		new MiniCssExtractPlugin(),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
};
