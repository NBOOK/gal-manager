<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import { useGameStore } from "@/store/global-store";

  const gameStore = useGameStore();
  const filterConfig = gameStore.filter;

  const filterLinked = computed(() => {
    const linked = filterConfig.linked;
    if (linked.toggled) {
      return {
        icon: linked.value ? "$mdiLinkVariant" : "$mdiLinkVariantOff",
        color: linked.value ? "green" : "red",
        action: () => {
          linked.value = !linked.value;
          linked.toggled = !linked.value;
        },
      };
    }
    return {
      icon: "$mdiLinkVariant",
      color: "geay-darken-4",
      action: () => (linked.toggled = true),
    };
  });

  const filterDatabase = computed(() => {
    const inDatabase = filterConfig.inDatabase;
    if (inDatabase.toggled)
      return {
        icon: ["$mdiDatabaseRemove", "$mdiDatabaseCheck", "$mdiDatabaseMinus"][
          inDatabase.value
        ],
        color: ["red", "green", "orange"][inDatabase.value],
        action: () => {
          inDatabase.value = (inDatabase.value + 1) % 3;
          inDatabase.toggled = inDatabase.value !== 1;
        },
      };
    return {
      icon: "$mdiDatabase",
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
        icon: ["$mdiImageRemove", "$mdiImageCheck", "$mdiImageMinus"][
          inAssets.value
        ],
        color: ["red", "green", "orange"][inAssets.value],
        action: () => {
          inAssets.value = (inAssets.value + 1) % 3;
          inAssets.toggled = inAssets.value !== 1;
        },
      };
    return {
      icon: "$mdiImage",
      color: "geay-darken-4",
      action: () => {
        inAssets.toggled = true;
      },
    };
  });

  const filterSelected = computed(() => {
    const selected = filterConfig.selected;
    if (selected.toggled)
      return {
        icon: selected.value
          ? "$mdiCheckboxMarked"
          : "$mdiCheckboxBlankOutline",
        color: "geay-darken-4",
        action: () => {
          selected.value = !selected.value;
          selected.toggled = !selected.value;
        },
      };
    return {
      icon: "$mdiCheckboxBlankOffOutline",
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
        icon: "$mdiCloud",
        color: inNetDisk.value ? "green" : "red",
        action: () => {
          inNetDisk.value = !inNetDisk.value;
          inNetDisk.toggled = !inNetDisk.value;
        },
      };
    return {
      icon: "$mdiCloud",
      color: "geay-darken-4",
      action: () => {
        inNetDisk.toggled = true;
      },
    };
  });

  const filterDeck = computed(() => {
    const inDeck = filterConfig.inDeck;
    if (inDeck.toggled)
      return {
        icon: "$mdiGamepadSquare",
        color: inDeck.value ? "green" : "red",
        action: () => {
          inDeck.value = !inDeck.value;
          inDeck.toggled = !inDeck.value;
        },
      };
    return {
      icon: "$mdiGamepadSquare",
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
        icon: "$mdiMicroSd",
        color: inSDCard.value ? "green" : "red",
        action: () => {
          inSDCard.value = !inSDCard.value;
          inSDCard.toggled = !inSDCard.value;
        },
      };
    return {
      icon: "$mdiMicroSd",
      color: "geay-darken-4",
      action: () => {
        inSDCard.toggled = true;
      },
    };
  });

  const wineRunnerFilter = ref<string[]>([]);
  watch(wineRunnerFilter, (newValue) => {
    if (newValue.length === 0) {
      filterConfig.wineRunner.toggled = false;
      filterConfig.wineRunner.value = "";
    } else {
      filterConfig.wineRunner.toggled = true;
      filterConfig.wineRunner.value = newValue[0];
    }
  });

  const winePrefixFilter = ref<string[]>([]);
  watch(winePrefixFilter, (newValue) => {
    if (newValue.length === 0) {
      filterConfig.winePrefix.toggled = false;
      filterConfig.winePrefix.value = "";
    } else {
      filterConfig.winePrefix.toggled = true;
      filterConfig.winePrefix.value = newValue[0];
    }
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
      inAssetsBackup: { toggled: false, value: true },

      wineRunner: { toggled: false, value: "" },
      winePrefix: { toggled: false, value: "" },
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
            ? '$mdiFilter'
            : '$mdiFilterOutline'
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
        <!-- <div class="d-flex">
          <div> -->
        <!-- <v-btn
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
            <v-divider></v-divider> -->
        <v-btn-group class="grid3x3">
          <v-btn @click="filterLinked.action">
            <v-icon
              :icon="filterLinked.icon"
              :color="filterLinked.color"
              size="x-large"
            ></v-icon>
          </v-btn>

          <v-btn @click="filterSelected.action">
            <v-icon
              :icon="filterSelected.icon"
              :color="filterSelected.color"
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

          <v-btn @click="filterCloud.action">
            <v-icon
              :icon="filterCloud.icon"
              :color="filterCloud.color"
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

          <v-btn @click="filterDatabase.action">
            <v-icon
              :icon="filterDatabase.icon"
              :color="filterDatabase.color"
              size="x-large"
            ></v-icon>
          </v-btn>

          <v-btn>
            <v-icon
              :icon="
                wineRunnerFilter.length === 0
                  ? '$customWineEmpty'
                  : '$customWineHalf'
              "
              size="x-large"
            ></v-icon>
            <v-menu
              activator="parent"
              scroll-strategy="close"
              transition="slide-y-transition"
              location="bottom center"
              origin="top center"
              :close-on-content-click="false"
            >
              <v-sheet rounded="lg">
                <v-list selectable v-model:selected="wineRunnerFilter">
                  <v-list-item
                    v-for="runner in gameStore.lutrisDB.wineRunners"
                    :key="runner"
                    :value="runner"
                  >
                    <v-list-item-title>{{ runner }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-sheet>
            </v-menu>
          </v-btn>

          <v-btn>
            <v-icon
              :icon="
                winePrefixFilter.length === 0
                  ? '$mdiPackageVariantClosed'
                  : '$mdiPackageVariant'
              "
              :color="
                winePrefixFilter.length === 0 ? 'grey-darken-4' : '#A57046'
              "
              size="x-large"
            ></v-icon>
            <v-menu
              activator="parent"
              scroll-strategy="close"
              transition="slide-y-transition"
              location="bottom center"
              origin="top center"
              :close-on-content-click="false"
            >
              <v-sheet rounded="lg">
                <v-list selectable v-model:selected="winePrefixFilter">
                  <v-list-item
                    v-for="prefix in gameStore.lutrisDB.winePrefixes"
                    :key="prefix"
                    :value="prefix"
                  >
                    <v-list-item-title>{{ prefix }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-sheet>
            </v-menu>
          </v-btn>
        </v-btn-group>

        <!-- <v-btn @click="filterStarred.action">
                <v-icon
                  :icon="filterStarred.icon"
                  :color="filterStarred.color"
                  size="x-large"
                ></v-icon>
              </v-btn> -->

        <!-- <v-btn @click="filterAssetsBackup.action">
            <v-icon
              :icon="filterAssetsBackup.icon"
              :color="filterAssetsBackup.color"
              size="x-large"
            ></v-icon>
          </v-btn> -->
        <!-- </div> -->

        <!-- <v-divider vertical></v-divider> -->

        <!-- <div> -->
        <!-- <v-btn
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
            <v-divider></v-divider> -->

        <!-- <v-btn-group class="grid2x2"> -->
        <!-- <v-btn @click="filterUSB.action">
                <v-icon
                  :icon="filterUSB.icon"
                  :color="filterUSB.color"
                  size="x-large"
                ></v-icon>
              </v-btn> -->
        <!-- </v-btn-group> -->
        <!-- </div>
        </div> -->

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
  .grid3x3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    height: 144px !important;
  }
</style>
