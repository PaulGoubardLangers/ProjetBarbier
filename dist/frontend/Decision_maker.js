var _a;
/**
 *  webpack
 */
// import * as tf from "@tensorflow/tfjs";
/** End of webpack */
import { Name_of_DMN_Decision, Trace } from "../common/Settings.js";
var IN_OUT;
(function (IN_OUT) {
    IN_OUT[IN_OUT["IN"] = 0] = "IN";
    IN_OUT[IN_OUT["OUT"] = 1] = "OUT";
})(IN_OUT || (IN_OUT = {}));
class Decision_maker {
    is_trained_() {
        return this._input_train_data && this._output_train_data;
    }
    // @ts-ignore
    _normalization(data, direction = IN_OUT.IN) {
        switch (direction) {
            case IN_OUT.IN:
                break;
            case IN_OUT.OUT:
                this._output_min = data.min(0);
                this._output_max = data.max(0);
                break;
            default: // Impossible...
                break;
        }
        return data.sub(data.min(0)).div(data.max(0).sub(data.min(0))); // '0' axis -> data...
    }
    get enumerations() {
        return this._enumerations;
    }
    get features() {
        return this._features;
    }
    get types() {
        return this._types;
    }
    get units() {
        return this._units;
    }
    get_enumeration_dimension(feature) {
        return this._enumerations.get(feature) === null ? Number.POSITIVE_INFINITY : this._enumerations.get(feature).length;
    }
    _get_classification_dimension() {
        return this._features.filter((feature, feature_index) => feature_index >= this._features.length - this._units) // Outputs...
            .reduce((dimension, feature) => Math.max(dimension, this._enumerations.get(feature) === null ? Number.POSITIVE_INFINITY : this._enumerations.get(feature).length), 0);
    }
    /**
     * '_units' est la dimension du tenseur de sortie sur la dernière couche ; a priori '1' pour une régression linéaire...
     */
    constructor(_decision, _enumerations, _features, _types, _units = 1) {
        this._decision = _decision;
        this._enumerations = _enumerations;
        this._features = _features;
        this._types = _types;
        this._units = _units;
        // @ts-ignore
        this._input_mean_standard_deviation = [undefined, undefined];
        // @ts-ignore
        this._output_mean_standard_deviation = [undefined, undefined];
        /** '_input_dimension' donne la dimension du tableau des données d'entrée (en remplacement de 'this_features.length
         * - this.units'). Cette dimension croît à cause du "hot-one encoding", i.e., des données de type énuméré...
         * Idem pour '_output_dimension' concernant le tableau des données de sortie.
         */
        this._input_dimension = 0; // Attention le zéro est utilisé dans l'init., ne pas changer...
        this._output_dimension = 0; // Attention le zéro est utilisé dans l'init., ne pas changer...
        // @ts-ignore
        this._denormalization = (data) => {
            return data.mul(this._output_max.sub(this._output_min)).add(this._output_min);
        };
        // @ts-ignore
        this._mean_standard_deviation = (data, direction, force) => {
            switch (direction) {
                case IN_OUT.IN:
                    if (force || (!this._input_mean_standard_deviation[0] && !this._input_mean_standard_deviation[1])) {
                        const mean = data.mean(0); // Dim. 0 is, by definition, that of sample...
                        this._input_mean_standard_deviation = [mean, data.sub(mean).square().mean(0).sqrt()];
                    }
                    return {
                        mean: this._input_mean_standard_deviation[0],
                        standard_deviation: this._input_mean_standard_deviation[1]
                    };
                    break;
                case IN_OUT.OUT:
                    if (force || (!this._output_mean_standard_deviation[0] && !this._output_mean_standard_deviation[1])) {
                        const mean = data.mean(0); // Dim. 0 is, by definition, that of sample...
                        this._output_mean_standard_deviation = [mean, data.sub(mean).square().mean(0).sqrt()];
                    }
                    return {
                        mean: this._output_mean_standard_deviation[0],
                        standard_deviation: this._output_mean_standard_deviation[1]
                    };
                    break;
                default: // Impossible...
                    break;
            }
        };
        // @ts-ignore
        this._destandardization = (data, direction) => {
            const { mean, standard_deviation } = this._mean_standard_deviation(data, direction, false);
            return data.mul(standard_deviation).add(mean);
        };
        // @ts-ignore
        this._standardization = (data, direction = IN_OUT.IN, force = true) => {
            const { mean, standard_deviation } = this._mean_standard_deviation(data, direction, force);
            return data.sub(mean).div(standard_deviation);
        };
        const classification_dimension = this._get_classification_dimension();
        const final_activation = classification_dimension === 2
            ? 'sigmoid' /* p. 103 */ : classification_dimension > 2 && classification_dimension !== Number.POSITIVE_INFINITY
            ? 'softmax' /* p. 119 */ : 'linear';
        // https://discuss.tensorflow.org/t/multiple-features-with-a-mix-of-onehot-and-floats-in-the-same-training/16574
        // https://stackoverflow.com/questions/59708075/tensorflowjs-different-shape-for-output
        // https://www.google.com/search?q=tensorflow.js+layer+output+shape&sca_esv=d66c42d153706fad&gl=us&hl=en&source=hp&ei=7CrrZZDkCNn_kdUPxYeUIA&iflsig=ANes7DEAAAAAZes4_Md7SwVM43RncfDJQWSta8uEzTyN&ved=0ahUKEwiQisf9-eSEAxXZf6QEHcUDBQQQ4dUDCBA&uact=5&oq=tensorflow.js+layer+output+shape&gs_lp=Egdnd3Mtd2l6IiB0ZW5zb3JmbG93LmpzIGxheWVyIG91dHB1dCBzaGFwZTIFECEYoAEyBRAhGKABMgUQIRigAUiKhAFQAFjGgQFwAHgAkAEAmAF5oAGGFaoBBDMwLjK4AQPIAQD4AQGYAiCgAr8WwgIFEAAYgATCAgsQLhiABBjHARjRA8ICBRAuGIAEwgIGEAAYFhgewgIIEAAYFhgeGA_CAgsQABiABBiKBRiGA8ICBBAhGBXCAgcQIRgKGKABmAMAkgcEMjkuM6AHxZMB&sclient=gws-wiz
        this._input_dimension = this._features.filter((feature, feature_index) => feature_index < this._features.length - this._units)
            .reduce((dimension, feature) => this._enumerations.get(feature) === null ? dimension + 1 : dimension + this._enumerations.get(feature).length, this._input_dimension);
        this._output_dimension = this._features.filter((feature, feature_index) => feature_index >= this._features.length - this._units)
            .reduce((dimension, feature) => this._enumerations.get(feature) === null ? dimension + 1 : dimension + this._enumerations.get(feature).length, this._output_dimension);
        this._model = tf.sequential();
        // First (hidden) layer is of "dense" type, output = input * kernel + bias
        this._model.add(tf.layers.dense({
            activation: _a.Activation, // 'sigmoid'
            /** IMPORTANT: the first layer in the model needs 'inputShape'. Make sure excluding batch size when providing 'inputShape'.
             * For example, if you plan to feed the model tensors of shape '[BS, 3, 3]', where 'BS' can be any batch size,
             * then specify 'inputShape' as '[3, 3]':
             */
            dtype: _a.Dtype,
            inputShape: [this._input_dimension],
            kernelInitializer: _a.Initializer, // 'leCunNormal'
            name: "A",
            // 2 weights: kernel is '[3,32]' while bias is '[32]' -> 3 * 32 + 32 = 128 param. (total number of weight parameters)
            units: _a.Units // 32
        }));
        // this._model.add(tf.layers.flatten()); -> si changement de dimension...
        // Second layer is of "dense" type, output tensor may be a scalar (e.g., likelihood):
        this._model.add(tf.layers.dense({
            activation: final_activation,
            // 'dtype' n'est utilisé que pour la première couche...
            // 'inputShape' n'est utilisé que pour la première couche...
            name: "B",
            units: this._output_dimension, // La sortie est par exemple une classification parmi 3 valeurs : IRIS, p. 116 du bouquin
        }));
    }
    get name() {
        return Name_of_DMN_Decision(this._decision);
    }
    // @ts-ignore
    _evaluate() {
        /* 'train' has to be run at least once... */
        if (!this.is_trained_())
            return null;
        let train_data_size = Math.ceil(this._input_train_data.shape[0] * _a._Train_data_percentage);
        // '[1]' -> on prend la *2e partie* de l'échantillon (après découpage) à droite, e.g. 20% :
        const input_test_data = tf.split(this._input_train_data, [train_data_size, -1])[1];
        // Calcul inutile a priori car la taille de l'échantillon de sortie doit être impérativement égale à celle de celui d'entrée :
        // train_data_size = Math.ceil(this._output_train_data.shape[0] * Decision_maker._Train_data_percentage);
        const output_test_data = tf.split(this._output_train_data, [train_data_size, -1])[1];
        // 'batchSize' (voir aussi 'fit') : attention, la fonction d'optimisation n'utilise qu'une partie des données si 'data.length > batchSize'
        // https://js.tensorflow.org/api/latest/#tf.LayersModel.evaluate
        const evaluation = this._model.evaluate(input_test_data, output_test_data, { batchSize: _a.BatchSize });
        // if (Trace)
        //     evaluation.print(true);
        // return evaluation.mul(this._output_mean_standard_deviation[1]);
        return evaluation.mul(this._output_max.sub(this._output_min));
    }
    async _pre_predict(data) {
        const input_buffer /*: tf.TensorBuffer<tf.Rank.R2, 'float32'> */ = tf.buffer([data.length, this._input_dimension], _a.Dtype);
        data.forEach((datum, index) => {
            // if (Trace)
            //     console.assert(datum.length === this._features.length - this._units, "'this._pre_predict' >> 'datum.length === this._features.length', untrue.");
            let i = 0;
            datum.forEach(async (value, index_) => {
                // if (Trace)
                //     console.assert(!(typeof value === 'string') || this._types[index] === 'string', "'Decision_maker._pre_predict' >> '!(typeof value === 'string') || this._types[index] === 'string'', untrue.");
                if (typeof value === 'string' && _a._Digests.get(value) === undefined)
                    _a._Digests.set(value, _a._Hash_code(value));
                if (Array.isArray(value)) /* One-hot encoding */
                    value.forEach(v => input_buffer.set(v, index, i++));
                else
                    input_buffer.set(typeof value === 'string' ? await _a._Digests.get(value) : value, index, i++); // Scalar...
            });
        });
        // On attend que les 'digest' des valeurs de type 'string' soient tous disponibles :
        await Promise.all(_a._Digests.values());
        if (this._input_predict_data)
            this._input_predict_data.dispose();
        this._input_predict_data = this._normalization(input_buffer.toTensor()); // [0,1]
        // this._input_predict_data = this._standardization(input_buffer.toTensor(), IN_OUT.IN, false); // [-1,1]
        if (Trace)
            this._input_predict_data.print(true);
    }
    async _pre_train(data) {
        const classification_dimension = this._get_classification_dimension();
        _a.Loss = classification_dimension === 2
            ? _a.Losses[0] : classification_dimension > 2 && classification_dimension !== Number.POSITIVE_INFINITY
            ? _a.Losses[1] : _a.Loss;
        /* 'sgd' -> stochastic gradient descent (p. 55, bottom of page): "stochastic" implies that not *ALL WEIGHTS* are used for optimization... */
        _a.Optimizer = classification_dimension === 2
            ? _a.Optimizers[2] : classification_dimension > 2 && classification_dimension !== Number.POSITIVE_INFINITY
            ? _a.Optimizers[2] : _a.Optimizer;
        // https://www.tensorflow.org/js/guide/train_models#optimizer_loss_and_metric
        this._model.compile({
            optimizer: _a.Optimizer,
            loss: _a.Loss
            // metrics: ['accuracy']
        });
        // if (Trace)
        //     this._model.summary(); // Print model topology...
        const input_buffer = tf.buffer([data.length, this._input_dimension], _a.Dtype);
        const output_buffer = tf.buffer([data.length, this._output_dimension], _a.Dtype);
        data.forEach((datum, index) => {
            // if (Trace)
            //     console.assert(datum.length === this._features.length, "'Decision_maker._pre_train' >> 'datum.length === this._features.length', untrue.");
            let i = 0;
            let j = 0;
            datum.forEach(async (value, index_) => {
                // if (Trace)
                //     console.assert(!(typeof value === 'string') || this._types[index] === 'string', "'Decision_maker._pre_train' >> '!(typeof value === 'string') || this._types[index] === 'string'', untrue.");
                if (typeof value === 'string' && _a._Digests.get(value) === undefined)
                    _a._Digests.set(value, _a._Hash_code(value));
                if (i < this._input_dimension)
                    if (Array.isArray(value)) /* One-hot encoding */
                        value.forEach(v => input_buffer.set(v, index, i++));
                    else
                        input_buffer.set(typeof value === 'string' ? await _a._Digests.get(value) : value, index, i++); // Scalar...
                else if (Array.isArray(value)) /* One-hot encoding */
                    value.forEach(v => output_buffer.set(v, index, j++));
                else
                    output_buffer.set(typeof value === 'string' ? await _a._Digests.get(value) : value, index, j++); // Scalar...
            });
        });
        // On attend que les 'digest' des valeurs de type 'string' soient tous disponibles :
        await Promise.all(_a._Digests.values());
        /** NOTE IMPORTANTE : si 'dtype' est égal 'int32', les calculs de normalisation sont arrondis...
         * Ca ne peut donc pas fonctionner pour harmoniser du "one-hot encoding" avec du numérique "classique".
         */
        /** TRAIN DATA */
        if (this._input_train_data)
            this._input_train_data.dispose();
        this._input_train_data = this._normalization(input_buffer.toTensor()); // [0,1]
        // this._input_train_data = this._standardization(input_buffer.toTensor()); // [-1,1]
        if (Trace)
            this._input_train_data.print(true);
        if (this._output_train_data)
            this._output_train_data.dispose();
        this._output_train_data = this._normalization(output_buffer.toTensor(), IN_OUT.OUT); // [0,1]
        // this._output_train_data = this._standardization(output_buffer.toTensor(), IN_OUT.OUT); // [-1,1]
        if (Trace)
            this._output_train_data.print(true);
        /**
         * Calculer la moyenne et l'écart type avec celles de 'data' plutôt que '0' ET '1'
         */
        // this._input_data = tf.randomNormal([input_buffer.shape[0], this._features.length - this._units - 1], 0, 1, 'float32', /*seed?*/Date.now());
        // this._output_data = tf.randomNormal([output_buffer.shape[0], this._units - 1], 0, 1, 'float32', /*seed?*/Date.now());
    }
    async predict(data) {
        // if (Trace)
        //     console.assert(this.is_trained_(), "'Decision_maker.predict' >> 'this.is_trained_()', untrue.");
        await this._pre_predict(data);
        // if (Trace)
        //     console.assert(this._input_predict_data, "'Decision_maker.predict' >> 'this._input_predict_data', untrue.");
        if (this._output_predict_data)
            this._output_predict_data.dispose();
        this._output_predict_data = this._model.predict(this._input_predict_data);
        if (Trace)
            this._output_predict_data.print(true);
        return this._denormalization(this._output_predict_data).arraySync();
    }
    train(data) {
        return new Promise(async (send) => {
            await this._pre_train(data);
            /**
             * On prélève un pourcentage de l'échantillon pour l'entrainement, e.g. 80%, le reste étant pour le test...
             */
            console.assert(data.length === this._input_train_data.shape[0] && data.length === this._output_train_data.shape[0]);
            const train_data_size = Math.ceil(data.length * _a._Train_data_percentage);
            // https://js.tensorflow.org/api/latest/#split
            const input_train_data = tf.split(this._input_train_data, [train_data_size, -1])[0]; // '-1' signifie que la 2e dimension est calculée automatiquement...
            const output_train_data = tf.split(this._output_train_data, [train_data_size, -1])[0];
            // https://js.tensorflow.org/api/latest/#tf.LayersModel.fit
            this._model.fit(input_train_data, output_train_data, {
                batchSize: _a.BatchSize,
                callbacks: {
                    onEpochBegin: (epoch, logs /*tf.Logs*/) => {
                        // if (Trace)
                        //     console.info("onEpochBegin " + this.name + ", epoch: " + epoch);
                    },
                    onEpochEnd: (epoch, logs /*tf.Logs*/) => {
                        // if (Trace)
                        //     console.info("onEpochEnd " + this.name + ", epoch: " + epoch);
                        const loss = logs?.loss;
                        const x = logs?.val_loss;
                    },
                    onTrainBegin: (logs /*tf.Logs*/) => {
                        window.dispatchEvent(new Event(_a.onTrainBegin + this.name));
                    },
                    onTrainEnd: (logs /*tf.Logs*/) => {
                        window.dispatchEvent(new CustomEvent(_a.onTrainEnd + this.name, { detail: { loss: this._evaluate().toString() } }));
                    }
                },
                epochs: _a.Epochs,
                /** The last 20% of train data are kept for "validation", i.e.,
                 * they aren't used within the 'optimizer' function (what about the 'loss' function?):
                 */
                validationSplit: _a._ValidationSplit
            })
                .then((history /*tf.History*/) => {
                if (Trace)
                    console.info("End of 'fit' - loss: " + history.history.loss[history.history.loss.length - 1]);
                send(history.history.loss[history.history.loss.length - 1]);
            })
                .catch((error) => send(error.message));
        });
    }
}
_a = Decision_maker;
// https://js.tensorflow.org/api/latest/#layers.activation
// Activation non linéaire (p. 96-97): back-propagation can be enabled because activation functions can be derived...
Decision_maker.Activations = ['elu', 'hardSigmoid', 'linear', 'relu', 'relu6', 'selu', 'sigmoid', 'softmax', 'softplus', 'softsign', 'tanh', 'swish', 'mish'];
Decision_maker.Activation = _a.Activations[6]; // 'sigmoid'
Decision_maker.Dtypes = ['float32', 'int32'];
Decision_maker.Dtype = _a.Dtypes[1]; // 'int32'
// Default is 'glorotNormal', which uses input data size *AND* output data size...
// Weights are generated as random numbers while 'leCunNormal' takes account of input data size *ONLY*...
Decision_maker.Initializers = ['constant', 'glorotNormal', 'glorotUniform', 'heNormal', 'heUniform', 'identity', 'leCunNormal', 'leCunUniform', 'ones', 'orthogonal', 'randomNormal', 'randomUniform', 'truncatedNormal', 'varianceScaling', 'zeros'];
Decision_maker.Initializer = _a.Initializers[6]; // 'leCunNormal'
// 'meanSquaredError' -> erreur quadratique moyenne (p. 74)
Decision_maker.Losses = ['binaryCrossentropy', 'categoricalCrossentropy', 'meanAbsoluteError', 'meanSquaredError'];
Decision_maker.Loss = _a.Losses[2]; // 'meanAbsoluteError'
Decision_maker.Optimizers = ['adadelta', 'adagrad', 'adam', 'adamax', 'momentum', 'rmsprop', 'sgd'];
Decision_maker.Optimizer = _a.Optimizers[6]; // 'sgd'
// It is a positive number that defines the dimensionality of the output space:
Decision_maker.Units = 32;
Decision_maker._Digests = new Map;
/**
 * '_Hash_code' transforms any DMN 'feature' value having 'string' type into 'number'
 * for injection within tensors...
 * Voir p. 322 pour un encodage beaucoup plus évolué du texte en général.
 */
Decision_maker._Hash_code = async (feature) => {
    // On génère un 'digest' de type "code de hachage" diminuant au max. les collisions :
    const digest = await window.crypto.subtle.digest("SHA-512", (new TextEncoder()).encode(feature));
    // 'digest' has 64 bytes, ce qui suppose que les valeurs de 'feature' ne sont pas trop longues
    // e.g., : "C++", "Java", "TypeScript", etc.
    return (new Uint8Array(digest)).reduce((sum, byte) => sum + byte, 0);
};
Decision_maker.onTrainBegin = "onTrainBegin";
Decision_maker.onTrainEnd = "onTrainEnd";
/**
 * Hyper-parameters
 */
// https://stackoverflow.com/questions/61029052/what-is-the-batchsize-in-tensorflows-model-fit-function
Decision_maker.BatchSize = 500;
Decision_maker.Epochs = 500;
// https://towardsdatascience.com/how-to-split-a-tensorflow-dataset-into-train-validation-and-test-sets-526c8dd29438
// A popular split is 80%, 10% and 10% for the train, validation and test sets.
Decision_maker._Train_data_percentage = 0.8; // <= 1.0 (2/3 in book, p.72, bottom of page...)
Decision_maker._ValidationSplit = 1.0 - _a._Train_data_percentage;
Decision_maker._Default_learning_rate = 0.01; // Note that this the default value used by TensorFlow.js...
export default Decision_maker;
//# sourceMappingURL=Decision_maker.js.map