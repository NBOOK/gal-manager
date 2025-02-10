<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  fillPercentage: {
    type: Number,
    default: 0,
    validator: (value: number) => value >= 0 && value <= 1,
  },
});

const [x, y, w, h] = [64, 176, 896, 672];

const fillHeight = computed(() => h * (0.1 + props.fillPercentage * 0.81));
const fillY = computed(() => y + h - fillHeight.value); // 从底部开始填充

const fillColor = computed(() =>
  props.fillPercentage < 0.5
    ? "#4EAF54"
    : props.fillPercentage < 0.8
    ? "#FEC02A"
    : props.fillPercentage < 0.9
    ? "#F88133"
    : "#F2413C"
);
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="`${x} ${y} ${w} ${h}`"
    style="height: 16px"
  >
    <defs>
      <mask id="fill-mask-gamepad">
        <rect :x="x" :y="y" :width="w" :height="h" fill="black" />
        <path
          d="M800 176H224a160 160 0 0 0-160 160v352a160 160 0 0 0 160 160h576a160 160 0 0 0 160-160v-352a160 160 0 0 0-160-160z"
          fill="white"
        />
      </mask>
    </defs>

    <!-- 填充层 -->
    <rect
      :x="x"
      :y="fillY"
      :width="w"
      :height="fillHeight"
      :fill="fillColor"
      mask="url(#fill-mask-gamepad)"
    />

    <path
      d="M800 176H224a160 160 0 0 0-160 160v352a160 160 0 0 0 160 160h576a160 160 0 0 0 160-160v-352a160 160 0 0 0-160-160z m96 512a96 96 0 0 1-96 96H224a96 96 0 0 1-96-96v-352a96 96 0 0 1 96-96h576a96 96 0 0 1 96 96zM576 368m32.32 0l63.36 0q32.32 0 32.32 32.32l0 31.36q0 32.32-32.32 32.32l-63.36 0q-32.32 0-32.32-32.32l0-31.36q0-32.32 32.32-32.32ZM672 560m32 0l64 0q32 0 32 32l0 32q0 32-32 32l-64 0q-32 0-32-32l0-32q0-32 32-32ZM384 384h-64v112H208v64H320V672h64v-112h112v-64H384V384z"
      fill="currentColor"
    />
  </svg>
</template>
