import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { compare, parseVersion, satisfies } from "./semver"

const yes = (version: string, range: string) =>
  assert.equal(satisfies(version, range), true, `${version} should satisfy ${range}`)
const no = (version: string, range: string) =>
  assert.equal(satisfies(version, range), false, `${version} should not satisfy ${range}`)

describe("parsing", () => {
  test("reads the three parts", () => {
    assert.deepEqual(parseVersion("1.2.3"), { major: 1, minor: 2, patch: 3, prerelease: [] })
  })

  test("accepts a leading v", () => {
    assert.equal(parseVersion("v1.2.3")?.major, 1)
  })

  test("splits prerelease identifiers, numeric ones as numbers", () => {
    assert.deepEqual(parseVersion("1.2.3-beta.1")?.prerelease, ["beta", 1])
  })

  test("discards build metadata", () => {
    assert.deepEqual(parseVersion("1.2.3+build.7")?.prerelease, [])
  })

  test("rejects what is not a version", () => {
    for (const value of ["", "1.2", "1", "x.y.z", "latest", "^1.2.3"]) {
      assert.equal(parseVersion(value), null, value)
    }
  })
})

describe("ordering", () => {
  test("compares part by part", () => {
    assert.ok(compare("1.0.0", "2.0.0")! < 0)
    assert.ok(compare("1.2.0", "1.10.0")! < 0)
    assert.ok(compare("1.2.10", "1.2.9")! > 0)
    assert.equal(compare("1.2.3", "1.2.3"), 0)
  })

  test("a prerelease precedes its release", () => {
    assert.ok(compare("1.0.0-beta", "1.0.0")! < 0)
    assert.ok(compare("1.0.0", "1.0.0-beta")! > 0)
  })

  test("numeric prerelease identifiers compare numerically", () => {
    assert.ok(compare("1.0.0-alpha.2", "1.0.0-alpha.10")! < 0)
  })

  test("numeric identifiers precede alphanumeric ones", () => {
    assert.ok(compare("1.0.0-1", "1.0.0-alpha")! < 0)
  })

  test("a shorter identifier set precedes a longer one sharing its prefix", () => {
    assert.ok(compare("1.0.0-alpha", "1.0.0-alpha.1")! < 0)
  })

  test("the spec's own ordering example holds", () => {
    const ordered = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
    ]
    for (let i = 0; i < ordered.length - 1; i++) {
      assert.ok(compare(ordered[i], ordered[i + 1])! < 0, `${ordered[i]} < ${ordered[i + 1]}`)
    }
  })

  test("unparseable input gives undefined rather than a guess", () => {
    assert.equal(compare("1.2.3", "not-a-version"), undefined)
  })
})

describe("exact and comparators", () => {
  test("a bare version matches only itself", () => {
    yes("1.2.3", "1.2.3")
    no("1.2.4", "1.2.3")
  })

  test("the five operators", () => {
    yes("1.2.3", ">=1.2.3")
    yes("1.2.4", ">=1.2.3")
    no("1.2.2", ">=1.2.3")
    yes("1.2.3", "<=1.2.3")
    no("1.2.4", "<=1.2.3")
    yes("1.2.4", ">1.2.3")
    no("1.2.3", ">1.2.3")
    yes("1.2.2", "<1.2.3")
    no("1.2.3", "<1.2.3")
    yes("1.2.3", "=1.2.3")
  })

  test("space means and", () => {
    yes("1.5.0", ">=1.0.0 <2.0.0")
    no("2.0.0", ">=1.0.0 <2.0.0")
    no("0.9.0", ">=1.0.0 <2.0.0")
  })
})

describe("caret", () => {
  test("keeps the major when it is non-zero", () => {
    yes("1.2.3", "^1.2.3")
    yes("1.9.9", "^1.2.3")
    no("2.0.0", "^1.2.3")
    no("1.2.2", "^1.2.3")
  })

  test("0.x keeps the minor", () => {
    yes("0.2.3", "^0.2.3")
    yes("0.2.9", "^0.2.3")
    no("0.3.0", "^0.2.3")
  })

  test("0.0.x keeps the patch", () => {
    yes("0.0.3", "^0.0.3")
    no("0.0.4", "^0.0.3")
  })

  test("the real ranges in this ecosystem", () => {
    yes("19.2.0", "^19.0.0")
    no("18.3.1", "^19.0.0")
    yes("0.562.0", "^0.562.0")
    no("0.563.0", "^0.562.0")
    yes("1.83.0", "^1.82.0")
    no("2.0.0", "^1.82.0")
  })
})

describe("tilde", () => {
  test("pins the minor when one is given", () => {
    yes("1.2.3", "~1.2.3")
    yes("1.2.9", "~1.2.3")
    no("1.3.0", "~1.2.3")
    no("1.2.2", "~1.2.3")
  })

  test("a partial tilde still pins the minor", () => {
    yes("1.2.0", "~1.2")
    yes("1.2.9", "~1.2")
    no("1.3.0", "~1.2")
  })

  test("~1 is the whole major", () => {
    yes("1.9.9", "~1")
    no("2.0.0", "~1")
  })
})

describe("wildcards and partials", () => {
  test("star accepts anything", () => {
    yes("1.2.3", "*")
    yes("0.0.1", "*")
  })

  test("x-ranges", () => {
    yes("1.2.9", "1.2.x")
    no("1.3.0", "1.2.x")
    yes("1.9.9", "1.x")
    no("2.0.0", "1.x")
  })

  test("a bare partial behaves as a range", () => {
    yes("1.2.9", "1.2")
    no("1.3.0", "1.2")
    yes("1.9.9", "1")
    no("2.0.0", "1")
  })

  test("a comparator on a partial", () => {
    yes("1.2.0", ">=1.2")
    no("1.1.9", ">=1.2")
    yes("1.3.0", ">1.2")
    no("1.2.9", ">1.2")
    no("1.2.0", "<1.2")
    yes("1.1.9", "<1.2")
  })
})

describe("or, and hyphen ranges", () => {
  test("either side may match", () => {
    yes("1.5.0", "^1.0.0 || ^2.0.0")
    yes("2.5.0", "^1.0.0 || ^2.0.0")
    no("3.0.0", "^1.0.0 || ^2.0.0")
  })

  test("the real multi-major peer range shape", () => {
    const range = "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
    yes("19.2.0", range)
    yes("16.0.1", range)
    no("15.0.0", range)
    no("20.0.0", range)
  })

  test("hyphen ranges are inclusive at both ends", () => {
    yes("1.2.3", "1.2.3 - 2.3.4")
    yes("2.3.4", "1.2.3 - 2.3.4")
    no("2.3.5", "1.2.3 - 2.3.4")
    no("1.2.2", "1.2.3 - 2.3.4")
  })

  test("a partial upper bound stays inclusive of everything under it", () => {
    yes("2.3.9", "1.2.3 - 2.3")
    no("2.4.0", "1.2.3 - 2.3")
    yes("2.9.9", "1.2.3 - 2")
    no("3.0.0", "1.2.3 - 2")
  })
})

describe("prereleases", () => {
  // Without this rule ^1.0.0 would accept 2.0.0-beta.1, which is a different
  // major that merely sorts below 2.0.0.
  test("a prerelease needs a comparator naming its own version", () => {
    no("2.0.0-beta.1", "^1.0.0")
    no("1.3.0-beta.1", "^1.2.0")
    yes("1.2.3-beta.2", ">=1.2.3-beta.1 <2.0.0")
  })

  test("a release is unaffected by the rule", () => {
    yes("1.2.3", "^1.0.0")
  })

  test("an exact prerelease matches itself", () => {
    yes("1.0.0-rc.1", "1.0.0-rc.1")
    no("1.0.0-rc.2", "1.0.0-rc.1")
  })
})

describe("declining rather than guessing", () => {
  test("an unparseable version gives undefined", () => {
    assert.equal(satisfies("not-a-version", "^1.0.0"), undefined)
  })

  test("an unparseable range gives undefined", () => {
    assert.equal(satisfies("1.0.0", "this is not a range"), undefined)
  })

  test("one bad alternative does not sink a good one", () => {
    assert.equal(satisfies("1.5.0", "garbage || ^1.0.0"), true)
  })
})
