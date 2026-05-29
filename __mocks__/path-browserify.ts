// path-browserify ships CommonJS, so its default import resolves to undefined
// under ts-jest. Node's built-in path module exposes an identical
// basename/join API, so we re-export it for tests.
import * as path from 'path'

// path-browserify uses POSIX ('/') semantics; export path.posix so tests
// behave identically on Windows.
export default path.posix
