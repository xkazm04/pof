// Synthetic C++ for the `cpp-handles` tests — written for these tests, no code, name or value from any
// reference project. The marker words, the registration calls, the types and the members are coined here
// (each checked whole-word against the reference clone before the first run: 0 hits).

/** A node header: handles of every keyword type kind, two named types, five coined scope words, and the near misses (an upper-case first word, a marker outside any class among them). */
export const LANTERNWICK_H = `#pragma once

namespace glade::nodes {

enum class Brightness { Dim, Glow, Blaze };

class Lanternwick : public NodeKernel {
    GLADE_KIND(Lanternwick, NodeKernel)
public:
    explicit Lanternwick(const Seed& seed);
    void kindle() override;
    void snuff();

    struct Wickcap {
        // knob_tuning at offset 0x5eed
        const float* mInner_k{};
        int mTally_k;
    };

protected:
    // knob_tuning at offset 0x5eed
    const float* mFlickerRate_k{};
    // knob_tuning at offset 0x5eed
    const int* mWickCount_k{};
    // knob_percall at offset 0x5eed
    bool* mIsLit_k{};
    // knob_percall_alt at offset 0x5eed
    const char* mSigil_k{};
    // knob_placed at offset 0x5eed
    void* mHook_k{};
    // knob_shared at offset 0x5eed
    const double* mBurnDepth_k{};
    // knob_tuning at offset 0x5eed
    glade::Phrase mPhrase_k{};
    // knob_percall at offset 0x5eed
    glade::Triple* mAim_k{};
    // knob_placed at offset 0x5eed
    unsigned short* mSpan_k{};
    // knob_tuning at offset 0x5eed
    float* mEmber_k[3]{};
    // knob_tuning at offset 0x5eed
    // const float* mOldWick_k{};
    float mStray_k;
    // knob_tuning at offset 0x5eed

    const float* mDrift_k{};
    // knob_tuning at offset 0x5eed
    void flare();
    // knob_tuning at offset 0x5eed
    const float* mTwoLine_k
        {};
    // knob_tuning at offset 0x5eed
    float* mPairA_k{}, *mPairB_k{};
    int mTrailing_k{};  // knob_tuning at offset 0x5eed
    float* mNoMarker_k{};
    // Spare at offset 0x5eed
    int mSpare_k{};
#if 0
    // knob_tuning at offset 0x5eed
    const float* mTallow_k{};
#endif
};

// knob_tuning at offset 0x5eed
const float* gLooseWick_k{};

}  // namespace glade::nodes
`;

/** Its source: definitions, and registration calls with coined names — which the handle reader never reads. */
export const LANTERNWICK_CPP = `#include "glade/lanternwick.h"

namespace glade::nodes {

Lanternwick::Lanternwick(const Seed& seed) : NodeKernel(seed) {}

void Lanternwick::kindle() {
    // knob_tuning at offset 0x5eed
    bindTuning(&mFlickerRate_k, "FlickerRate");
    bindPerCall(&mIsLit_k, "IsLit");
    bindPerCallAlt(&mSigil_k, "Sigil");
    bindPlaced(&mHook_k, "Hook");
    bindShared(&mBurnDepth_k, "BurnDepth");
}

void Lanternwick::snuff() {}

}  // namespace glade::nodes
`;

/** A node header with no handle at all. */
export const QUILLMOOR_H = `#pragma once

namespace glade::nodes {

class Quillmoor : public NodeKernel {
public:
    void kindle() override;

protected:
    int mGust_k;
};

}  // namespace glade::nodes
`;
