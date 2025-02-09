<script setup lang="ts">
import { ref } from "vue";
import GameEntry from "@/modules/GameEntry";

defineProps<{ game: GameEntry }>(); // use props.game to access the game object
const overlay = ref(false);
const page = ref(0);

function toggleOverlay() {
  overlay.value = !overlay.value;
}
</script>

<template>
  <!-- 左侧图片 -->
  <v-col class="flex-grow-0 pa-0">
    <div class="game-image">
      <img
        v-if="game.imageAssets.headerSDPath"
        :src="`file://${game.imageAssets.headerSDPath}`"
        @click="toggleOverlay"
      />
      <div v-else class="game-image-placeholder"></div>
    </div>
  </v-col>
  <v-overlay
    v-model="overlay"
    class="align-center justify-center"
    style="backdrop-filter: blur(1rem)"
    @click="toggleOverlay"
  >
    <v-container width="85vw" max-height="100vh">
      <v-carousel v-model="page" :show-arrows="false" hide-delimiters>
        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.capsulePath}`"
        ></v-carousel-item>

        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.headerPath}`"
        ></v-carousel-item>

        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.heroPath}`"
        ></v-carousel-item>

        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.logoPath}`"
        ></v-carousel-item>

        <v-carousel-item
          :draggable="false"
          :src="`file://${game.imageAssets.iconPath}`"
        ></v-carousel-item>
      </v-carousel>

      <v-slide-group
        v-model="page"
        class="nav-thumbnail mt-3"
        center-active
        show-arrows
        mandatory
        @click.stop="() => {}"
        selected-class="nav-item-selected"
      >
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.capsuleSDPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.headerSDPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.heroSDPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.logoPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
        <v-slide-group-item v-slot="{ selectedClass, toggle }">
          <img
            :src="`file://${game.imageAssets.iconPath}`"
            @click.stop="toggle"
            :class="['nav-item', selectedClass]"
          />
        </v-slide-group-item>
      </v-slide-group>
      <!-- <br />
      <div class="d-flex justify-space-evenly align-center">
        <v-btn
          icon="$mdiChevronLeft"
          @click.stop="page = (page + 5 - 1) % 5"
        ></v-btn>
        <v-btn
          icon="$mdiChevronRight"
          @click.stop="page = (page + 1) % 5"
        ></v-btn>
      </div> -->
    </v-container>
  </v-overlay>
</template>

<style scoped>
.game-image {
  height: 100px;
  border-radius: 5px;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
}

.game-image img {
  height: 100px;
  object-fit: cover;
  border-radius: 5px;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
  cursor: pointer;
}

.game-image-placeholder {
  height: 100px;
  border-radius: 5px;
  background-color: #f0f0f0;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
}

.nav-thumbnail :deep(.v-slide-group__content) {
  justify-content: center !important;
}

.nav-item {
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  max-height: 50px;
  margin: 0 5px 15px 5px;
  opacity: 0.5;
}

.nav-item-selected {
  box-shadow: 0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 5px 8px 0 rgba(0, 0, 0, 0.14),
    0 1px 14px 0 rgba(0, 0, 0, 0.12) !important;
  opacity: 1;
}
</style>
