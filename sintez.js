export { encodeWAV, evaluate, generatePCM, tokenize, typeify };

// sample[n]= A ⋅ sin(2 * π * f * (n / R)​)

// Where:
//   A: Amplitude (max value based on bit depth, e.g., 32767 for 16-bit)
//   f: Frequency (Hz), e.g., middle C = 261.63 Hz
//   R: Sample rate (samples per second), typically 44100 Hz
//   n: Sample number (integer), from 0 to R × duration − 1

function generatePCM(frequency, duration) {
  const amplitude = 32767;
  const sampleRate = 44100;

  const numSamples = Math.floor(sampleRate * (duration / 1000));

  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
    samples.push(sample);
  }

  return samples;
}

async function encodeWAV(samples, output = "output.wav", sampleRate = 44100) {
  const headerSize = 44;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(headerSize + i * 2, samples[i], true);
  }

  await Deno.writeFile(output, new Uint8Array(buffer));
}

const atom = (name) => Symbol.for(name);

//typeify token : atom or number
const typeify = (token) => {
  if (isNaN(Number(token))) {
    return atom(token);
  } else {
    return Number(token);
  }
};

const tokenize = (input) => {
  const loop = (progressiveScope, graphemes, tokenSoFar = "") => {
    const [graphemeAtHand, ...restOfGraphemes] = graphemes;
    const [currentScope, ...prevScopes] = progressiveScope;

    if (graphemes.length === 0) {
      if (tokenSoFar.length === 0) {
        return currentScope;
      } else {
        return [...currentScope, typeify(tokenSoFar)];
      }
    }

    const pushToken = () => {
      if (tokenSoFar.length > 0) {
        currentScope.push(typeify(tokenSoFar));
        tokenSoFar = "";
      }
    };

    switch (graphemeAtHand) {
      case " ":
        pushToken();
        break;

      case "(":
        // check if we have a dangling token, if so - push it to the current scope
        pushToken();
        progressiveScope = [[], ...progressiveScope];
        break;

      case ")":
        pushToken();
        const [prevScope, ...otherScopes] = prevScopes;
        progressiveScope = [[...prevScope, currentScope], ...otherScopes];
        break;

      default:
        tokenSoFar += graphemeAtHand;
    }
    return loop(progressiveScope, restOfGraphemes, tokenSoFar);
  };

  return loop([[]], Array.from(input));
};

const evaluate = (expression,acc=0) => {
  if (!Array.isArray(expression)) {
    return new Error("expression must be an array");
  }


  const [first, ...rest] = expression;

  switch (first) {
    case atom("tone"):
      try {
        return generatePCM(rest[0], rest[1]);
      } catch (e) {
        return new Error(e);
      }
    default:
      return new Error("Unknown operator")
    
  }
};
