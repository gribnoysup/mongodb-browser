const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

const shared = {
  target: 'web',
  devtool: false,
  module: {
    rules: [
      {
        loader: require.resolve('babel-loader'),
        test: /\.(t|j)sx?$/,
        options: {
          babelrc: false,
          configFile: false,
          compact: false,
          sourceType: 'unambiguous',
          presets: [
            require.resolve('@babel/preset-react'),
            require.resolve('@babel/preset-typescript')
          ]
        }
      }
    ]
  },
  resolve: {
    alias: {
      // to make sure we're always resolving the same version
      bson: require.resolve('bson'),

      // alias to the prebundled package (used by dns polyfill)
      dohjs: require.resolve('dohjs/dist/doh.js'),

      // reimplemented to work in the browser
      dns: path.resolve(__dirname, 'src/dns.ts'),

      // reimplemented, requires a proxy running on the backend
      tls: path.resolve(__dirname, 'src/tls.ts'),
      net: path.resolve(__dirname, 'src/net.ts'),

      // required polyfill
      stream: 'readable-stream',
      buffer: require.resolve('buffer/'),

      // --- we probably don't need all of it, can cherry-pick only required
      // polyfills
      util: require.resolve('util/'),
      timers: 'timers-browserify',
      crypto: 'crypto-browserify',
      os: 'os-browserify',
      // ---

      // driver re-binds exported methods, and so we have to provide a polyfill
      zlib: path.resolve(__dirname, 'src', 'zlib.ts'),

      // for this alias to work we need to compile for async generator
      // supporting environments (i.e., no babel runtime transforms)
      url: 'whatwg-url',
      // optional dep that we need to alias (otherwise empty module breaks the
      // driver code)
      'bson-ext': 'bson',

      // optional encryption stuff
      'gcp-metadata': false,
      '@mongodb-js/saslprep': false
    },
    // `<package>: false` in fallback returns an empty module on import, in some
    // cases this can lead to unpredictable behavior (see bson-ext that we now
    // alias to bson)
    fallback: {
      // optional driver deps
      fs: false,
      path: false,
      // compression
      '@mongodb-js/zstd': false,
      snappy: false,
      'snappy/package.json': false,
      // encryption
      kerberos: false,
      'mongodb-client-encryption': false,
      child_process: false,
      // used by aws auth method
      aws4: false,
      https: false,
      http: false,

      vm: false
    },
    extensions: ['.ts', '.tsx', '...']
  },
  plugins: [
    // Alias global variables to module imports
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: [path.resolve(__dirname, 'src/process.ts'), 'default']
    })
  ]
};

module.exports = [
  {
    name: 'sandbox',
    ...shared,
    plugins: shared.plugins.concat(new HtmlWebpackPlugin()),
    resolve: {
      ...shared.resolve,
      alias: {
        ...shared.resolve.alias,

        // // enable for debugging
        // mongodb: path.resolve(
        //   __dirname,
        //   'node-mongodb-native',
        //   'src',
        //   'index.ts'
        // ),

        vm: require.resolve('vm-browserify')
      }
    },
    entry: {
      main: path.resolve(__dirname, 'sandbox', 'index.ts')
    },
    devServer: {
      allowedHosts: 'all',
      historyApiFallback: true,
      hot: false,
      liveReload: false,
      port: 9000,
      client: false,
      webSocketServer: false,
      devMiddleware: {
        writeToDisk: true
      }
    }
  },
  {
    name: 'mongodb-browser',
    ...shared,
    entry: {
      'mongodb-browser': path.resolve(__dirname, 'src', 'mongodb.ts')
    },
    output: {
      libraryTarget: 'commonjs2'
    }
  },
  {
    name: 'proxy',
    target: 'node',
    module: shared.module,
    entry: {
      'proxy-server': path.resolve(__dirname, 'src', 'proxy.ts')
    },
    externals: {
      mongodb: 'commonjs2 mongodb'
    },
    output: {
      libraryTarget: 'commonjs2'
    }
  }
];
