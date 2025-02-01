<script setup lang="ts">
  import { computed } from "vue";
  import { useGameStore } from "@/store/global-store";

  const gameStore = useGameStore();
  const filterConfig = gameStore.filter;

  const filterLinked = computed(() => {
    const linked = filterConfig.linked;
    if (linked.toggled) {
      return {
        icon: linked.value ? "mdi-link" : "mdi-link-off",
        color: linked.value ? "green" : "red",
        action: () => {
          linked.value = !linked.value;
          linked.toggled = !linked.value;
        },
      };
    }
    return {
      icon: "mdi-link",
      color: "geay-darken-4",
      action: () => (linked.toggled = true),
    };
  });

  const filterDatabase = computed(() => {
    const inDatabase = filterConfig.inDatabase;
    if (inDatabase.toggled)
      return {
        icon: [
          "mdi-database-remove",
          "mdi-database-check",
          "mdi-database-minus",
        ][inDatabase.value],
        color: ["red", "green", "orange"][inDatabase.value],
        action: () => {
          inDatabase.value = (inDatabase.value + 1) % 3;
          inDatabase.toggled = inDatabase.value !== 1;
        },
      };
    return {
      icon: "mdi-database",
      color: "geay-darken-4",
      action: () => {
        inDatabase.toggled = true;
      },
    };
  });

  const filterImage = computed(() => {
    const inAssets = filterConfig.inAssets;
    if (inAssets.toggled)
      return {
        icon: ["mdi-image-remove", "mdi-image-check", "mdi-image-minus"][
          inAssets.value
        ],
        color: ["red", "green", "orange"][inAssets.value],
        action: () => {
          inAssets.value = (inAssets.value + 1) % 3;
          inAssets.toggled = inAssets.value !== 1;
        },
      };
    return {
      icon: "mdi-image",
      color: "geay-darken-4",
      action: () => {
        inAssets.toggled = true;
      },
    };
  });

  // const filterStarred = computed(() => {
  //   const starred = filterConfig.starred;
  //   if (starred.toggled)
  //     return {
  //       icon: starred.value ? "mdi-star" : "mdi-star-outline",
  //       color: "amber",
  //       action: () => {
  //         starred.value = !starred.value;
  //         starred.toggled = !starred.value;
  //       },
  //     };
  //   return {
  //     icon: "mdi-star",
  //     color: "geay-darken-4",
  //     action: () => {
  //       starred.toggled = true;
  //     },
  //   };
  // });

  const filterSelected = computed(() => {
    const selected = filterConfig.selected;
    if (selected.toggled)
      return {
        icon: selected.value
          ? "mdi-checkbox-marked"
          : "mdi-checkbox-blank-outline",
        color: "geay-darken-4",
        action: () => {
          selected.value = !selected.value;
          selected.toggled = !selected.value;
        },
      };
    return {
      icon: "mdi-checkbox-blank-off-outline",
      color: "geay-darken-4",
      action: () => {
        selected.toggled = true;
      },
    };
  });

  const filterCloud = computed(() => {
    const inNetDisk = filterConfig.inNetDisk;
    if (inNetDisk.toggled)
      return {
        icon: "mdi-cloud",
        color: inNetDisk.value ? "green" : "red",
        action: () => {
          inNetDisk.value = !inNetDisk.value;
          inNetDisk.toggled = !inNetDisk.value;
        },
      };
    return {
      icon: "mdi-cloud",
      color: "geay-darken-4",
      action: () => {
        inNetDisk.toggled = true;
      },
    };
  });

  const filterAssetsBackup = computed(() => {
    const inAssetsBackup = filterConfig.inAssetsBackup;
    if (inAssetsBackup.toggled)
      return {
        icon: "mdi-folder-image",
        color: inAssetsBackup.value ? "green" : "red",
        action: () => {
          inAssetsBackup.value = !inAssetsBackup.value;
          inAssetsBackup.toggled = !inAssetsBackup.value;
        },
      };
    return {
      icon: "mdi-folder-image",
      color: "geay-darken-4",
      action: () => {
        inAssetsBackup.toggled = true;
      },
    };
  });

  const filterDeck = computed(() => {
    const inDeck = filterConfig.inDeck;
    if (inDeck.toggled)
      return {
        icon: "mdi-gamepad-square",
        color: inDeck.value ? "green" : "red",
        action: () => {
          inDeck.value = !inDeck.value;
          inDeck.toggled = !inDeck.value;
        },
      };
    return {
      icon: "mdi-gamepad-square",
      color: "geay-darken-4",
      action: () => {
        inDeck.toggled = true;
      },
    };
  });

  const filterSD = computed(() => {
    const inSDCard = filterConfig.inSDCard;
    if (inSDCard.toggled)
      return {
        icon: "mdi-micro-sd",
        color: inSDCard.value ? "green" : "red",
        action: () => {
          inSDCard.value = !inSDCard.value;
          inSDCard.toggled = !inSDCard.value;
        },
      };
    return {
      icon: "mdi-micro-sd",
      color: "geay-darken-4",
      action: () => {
        inSDCard.toggled = true;
      },
    };
  });

  const filterUSB = computed(() => {
    const inUSB = filterConfig.inUSB;
    if (inUSB.toggled)
      return {
        icon: "mdi-usb",
        color: inUSB.value ? "green" : "red",
        action: () => {
          inUSB.value = !inUSB.value;
          inUSB.toggled = !inUSB.value;
        },
      };
    return {
      icon: "mdi-usb",
      color: "geay-darken-4",
      action: () => {
        inUSB.toggled = true;
      },
    };
  });

  function resetFilters() {
    Object.assign(filterConfig, {
      linked: { toggled: false, value: true },
      inDatabase: { toggled: false, value: 1 },
      inAssets: { toggled: false, value: 1 },
      starred: { toggled: false, value: true },
      selected: { toggled: false, value: true },
      inNetDisk: { toggled: false, value: true },
      inSDCard: { toggled: false, value: true },
      inDeck: { toggled: false, value: true },
      inUSB: { toggled: false, value: true },
    });

    Object.assign(gameStore.filterOperator, {
      group1: true,
      group2: true,
    });
  }
</script>

<template>
  <!-- Filter -->
  <v-btn icon @contextmenu.prevent="resetFilters">
    <v-icon
      :icon="Object.values(filterConfig).some((filter: any) => filter.toggled)
            ? 'mdi-filter'
            : 'mdi-filter-outline'
          "
    ></v-icon>
    <v-menu
      activator="parent"
      :close-on-content-click="false"
      scroll-strategy="close"
      transition="slide-y-transition"
      location="bottom center"
      origin="top center"
    >
      <v-sheet rounded="lg">
        <div class="d-flex">
          <div>
            <v-btn
              width="100%"
              variant="flat"
              density="compact"
              v-model="gameStore.filterOperator.group1"
              @click="
                gameStore.filterOperator.group1 =
                  !gameStore.filterOperator.group1
              "
            >
              {{ gameStore.filterOperator.group1 ? "AND" : "OR" }}
            </v-btn>
            <v-divider></v-divider>
            <v-btn-group class="grid2x2">
              <v-btn @click="filterLinked.action">
                <v-icon
                  :icon="filterLinked.icon"
                  :color="filterLinked.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterDatabase.action">
                <v-icon
                  :icon="filterDatabase.icon"
                  :color="filterDatabase.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterImage.action">
                <v-icon
                  :icon="filterImage.icon"
                  :color="filterImage.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <!-- <v-btn @click="filterStarred.action">
                <v-icon
                  :icon="filterStarred.icon"
                  :color="filterStarred.color"
                  size="x-large"
                ></v-icon>
              </v-btn> -->

              <v-btn @click="filterSelected.action">
                <v-icon
                  :icon="filterSelected.icon"
                  :color="filterSelected.color"
                  size="x-large"
                ></v-icon>
              </v-btn>
            </v-btn-group>
          </div>

          <v-divider vertical></v-divider>

          <div>
            <v-btn
              width="100%"
              variant="flat"
              density="compact"
              v-model="gameStore.filterOperator.group2"
              @click="
                gameStore.filterOperator.group2 =
                  !gameStore.filterOperator.group2
              "
            >
              {{ gameStore.filterOperator.group2 ? "AND" : "OR" }}
            </v-btn>
            <v-divider></v-divider>
            <v-btn-group class="grid2x2">
              <v-btn @click="filterCloud.action">
                <v-icon
                  :icon="filterCloud.icon"
                  :color="filterCloud.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterAssetsBackup.action">
                <v-icon
                  :icon="filterAssetsBackup.icon"
                  :color="filterAssetsBackup.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterDeck.action">
                <v-icon
                  :icon="filterDeck.icon"
                  :color="filterDeck.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <v-btn @click="filterSD.action">
                <v-icon
                  :icon="filterSD.icon"
                  :color="filterSD.color"
                  size="x-large"
                ></v-icon>
              </v-btn>

              <!-- <v-btn @click="filterUSB.action">
                <v-icon
                  :icon="filterUSB.icon"
                  :color="filterUSB.color"
                  size="x-large"
                ></v-icon>
              </v-btn> -->
            </v-btn-group>
          </div>
        </div>

        <!-- <v-divider></v-divider>

        <v-btn
          width="100%"
          variant="flat"
          density="compact"
          v-model="gameStore.filterOperator.group1"
          @click="resetFilters"
        >
          Clear
        </v-btn> -->
      </v-sheet>
    </v-menu>
  </v-btn>
</template>

<style>
  .grid2x2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    /* 2 列 */
    height: 96px !important;
  }
</style>
