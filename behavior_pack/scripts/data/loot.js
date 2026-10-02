// GENERATED from data/psychedelicraft/loot_java.json (verbatim Java loot) - do not edit by hand.
export const LOOT_TABLES = {
  "blocks/acacia_barrel": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:dynamic",
            "name": "minecraft:contents"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/bottle_rack": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:bottle_rack"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/cannabis": {
    "type": "minecraft:block",
    "functions": [
      {
        "function": "minecraft:explosion_decay"
      }
    ],
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:alternatives",
            "children": [
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "block": "psychedelicraft:cannabis",
                    "condition": "minecraft:block_state_property",
                    "properties": {
                      "age": {
                        "min": "5",
                        "max": "15"
                      }
                    }
                  }
                ],
                "name": "psychedelicraft:cannabis_leaf"
              },
              {
                "type": "minecraft:item",
                "name": "psychedelicraft:cannabis_seeds"
              }
            ]
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:alternatives",
            "children": [
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "block": "psychedelicraft:cannabis",
                    "condition": "minecraft:block_state_property",
                    "properties": {
                      "age": "15"
                    }
                  }
                ],
                "name": "psychedelicraft:cannabis_buds"
              }
            ]
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "block": "psychedelicraft:cannabis",
            "condition": "minecraft:block_state_property",
            "properties": {
              "age": "15"
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "enchantment": "minecraft:fortune",
                "formula": "minecraft:binomial_with_bonus_count",
                "function": "minecraft:apply_bonus",
                "parameters": {
                  "extra": 3,
                  "probability": 0.5714286
                }
              }
            ],
            "name": "psychedelicraft:cannabis_seeds"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/coca": {
    "type": "minecraft:block",
    "functions": [
      {
        "function": "minecraft:explosion_decay"
      }
    ],
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:alternatives",
            "children": [
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "block": "psychedelicraft:coca",
                    "condition": "minecraft:block_state_property",
                    "properties": {
                      "age": {
                        "min": "5",
                        "max": "12"
                      }
                    }
                  }
                ],
                "name": "psychedelicraft:coca_leaves"
              },
              {
                "type": "minecraft:item",
                "name": "psychedelicraft:coca_seeds"
              }
            ]
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "block": "psychedelicraft:coca",
            "condition": "minecraft:block_state_property",
            "properties": {
              "age": {
                "min": "5",
                "max": "12"
              }
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "enchantment": "minecraft:fortune",
                "formula": "minecraft:binomial_with_bonus_count",
                "function": "minecraft:apply_bonus",
                "parameters": {
                  "extra": 3,
                  "probability": 0.5714286
                }
              }
            ],
            "name": "psychedelicraft:coca_seeds"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/coffea": {
    "type": "minecraft:block",
    "functions": [
      {
        "function": "minecraft:explosion_decay"
      }
    ],
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:alternatives",
            "children": [
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "block": "psychedelicraft:coffea",
                    "condition": "minecraft:block_state_property",
                    "properties": {
                      "age": {
                        "min": "1",
                        "max": "7"
                      }
                    }
                  }
                ],
                "functions": [
                  {
                    "add": false,
                    "count": {
                      "type": "minecraft:uniform",
                      "max": 4,
                      "min": 3
                    },
                    "function": "minecraft:set_count"
                  },
                  {
                    "function": "minecraft:explosion_decay"
                  }
                ],
                "name": "psychedelicraft:coffea_cherries"
              }
            ]
          }
        ],
        "rolls": 2
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "block": "psychedelicraft:coffea",
            "condition": "minecraft:block_state_property",
            "properties": {
              "age": "7",
              "top": "true"
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "enchantment": "minecraft:fortune",
                "formula": "minecraft:binomial_with_bonus_count",
                "function": "minecraft:apply_bonus",
                "parameters": {
                  "extra": 3,
                  "probability": 0.5714286
                }
              }
            ],
            "name": "psychedelicraft:coffea_cherries"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/dark_oak_barrel": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:dynamic",
            "name": "minecraft:contents"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/distillery": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:dynamic",
            "name": "minecraft:contents"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/drying_table": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:drying_table"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/flask": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:dynamic",
            "name": "minecraft:contents"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/fruiting_juniper_leaves": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:alternatives",
            "children": [
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "condition": "minecraft:any_of",
                    "terms": [
                      {
                        "condition": "minecraft:match_tool",
                        "predicate": {
                          "items": [
                            "minecraft:shears"
                          ]
                        }
                      },
                      {
                        "condition": "minecraft:match_tool",
                        "predicate": {
                          "enchantments": [
                            {
                              "enchantment": "minecraft:silk_touch",
                              "levels": {
                                "min": 1
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                ],
                "name": "psychedelicraft:fruiting_juniper_leaves"
              },
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "condition": "minecraft:survives_explosion"
                  }
                ],
                "name": "psychedelicraft:juniper_berries"
              }
            ]
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:inverted",
            "term": {
              "condition": "minecraft:any_of",
              "terms": [
                {
                  "condition": "minecraft:match_tool",
                  "predicate": {
                    "items": [
                      "minecraft:shears"
                    ]
                  }
                },
                {
                  "condition": "minecraft:match_tool",
                  "predicate": {
                    "enchantments": [
                      {
                        "enchantment": "minecraft:silk_touch",
                        "levels": {
                          "min": 1
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "conditions": [
              {
                "chances": [
                  0.02,
                  0.022222223,
                  0.025,
                  0.033333335,
                  0.1
                ],
                "condition": "minecraft:table_bonus",
                "enchantment": "minecraft:fortune"
              }
            ],
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 2,
                  "min": 1
                },
                "function": "minecraft:set_count"
              },
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:juniper_berries"
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:inverted",
            "term": {
              "condition": "minecraft:any_of",
              "terms": [
                {
                  "condition": "minecraft:match_tool",
                  "predicate": {
                    "items": [
                      "minecraft:shears"
                    ]
                  }
                },
                {
                  "condition": "minecraft:match_tool",
                  "predicate": {
                    "enchantments": [
                      {
                        "enchantment": "minecraft:silk_touch",
                        "levels": {
                          "min": 1
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "conditions": [
              {
                "condition": "minecraft:survives_explosion"
              },
              {
                "chances": [
                  0.005,
                  0.0055555557,
                  0.00625,
                  0.008333334,
                  0.025
                ],
                "condition": "minecraft:table_bonus",
                "enchantment": "minecraft:fortune"
              }
            ],
            "name": "minecraft:apple"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/hop": {
    "type": "minecraft:block",
    "functions": [
      {
        "function": "minecraft:explosion_decay"
      }
    ],
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:alternatives",
            "children": [
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "block": "psychedelicraft:hop",
                    "condition": "minecraft:block_state_property",
                    "properties": {
                      "age": {
                        "min": "11",
                        "max": "15"
                      }
                    }
                  }
                ],
                "name": "psychedelicraft:hop_cones"
              },
              {
                "type": "minecraft:item",
                "name": "psychedelicraft:hop_seeds"
              }
            ]
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "block": "psychedelicraft:hop",
            "condition": "minecraft:block_state_property",
            "properties": {
              "age": "15"
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "enchantment": "minecraft:fortune",
                "formula": "minecraft:binomial_with_bonus_count",
                "function": "minecraft:apply_bonus",
                "parameters": {
                  "extra": 3,
                  "probability": 0.5714286
                }
              }
            ],
            "name": "psychedelicraft:hop_cones"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/iron_drying_table": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:iron_drying_table"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/jungle_barrel": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:dynamic",
            "name": "minecraft:contents"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/juniper_button": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_button"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_door": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "conditions": [
              {
                "block": "psychedelicraft:juniper_door",
                "condition": "minecraft:block_state_property",
                "properties": {
                  "half": "lower"
                }
              }
            ],
            "name": "psychedelicraft:juniper_door"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_fence": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_fence"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_fence_gate": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_fence_gate"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_leaves": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:alternatives",
            "children": [
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "condition": "minecraft:any_of",
                    "terms": [
                      {
                        "condition": "minecraft:match_tool",
                        "predicate": {
                          "items": [
                            "minecraft:shears"
                          ]
                        }
                      },
                      {
                        "condition": "minecraft:match_tool",
                        "predicate": {
                          "enchantments": [
                            {
                              "enchantment": "minecraft:silk_touch",
                              "levels": {
                                "min": 1
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                ],
                "name": "psychedelicraft:juniper_leaves"
              },
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "condition": "minecraft:survives_explosion"
                  },
                  {
                    "chances": [
                      0.05,
                      0.0625,
                      0.083333336,
                      0.1
                    ],
                    "condition": "minecraft:table_bonus",
                    "enchantment": "minecraft:fortune"
                  }
                ],
                "name": "psychedelicraft:juniper_sapling"
              }
            ]
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:inverted",
            "term": {
              "condition": "minecraft:any_of",
              "terms": [
                {
                  "condition": "minecraft:match_tool",
                  "predicate": {
                    "items": [
                      "minecraft:shears"
                    ]
                  }
                },
                {
                  "condition": "minecraft:match_tool",
                  "predicate": {
                    "enchantments": [
                      {
                        "enchantment": "minecraft:silk_touch",
                        "levels": {
                          "min": 1
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "conditions": [
              {
                "chances": [
                  0.02,
                  0.022222223,
                  0.025,
                  0.033333335,
                  0.1
                ],
                "condition": "minecraft:table_bonus",
                "enchantment": "minecraft:fortune"
              }
            ],
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 2,
                  "min": 1
                },
                "function": "minecraft:set_count"
              },
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "minecraft:stick"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_log": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_log"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_planks": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_planks"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_pressure_plate": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_pressure_plate"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_sapling": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_sapling"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_sign": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_sign"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_slab": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_slab"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_stairs": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_stairs"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_trapdoor": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_trapdoor"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_wall_sign": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_sign"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/juniper_wood": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_wood"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/lattice": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:lattice"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/mash_tub": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:dynamic",
            "name": "minecraft:contents"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/morning_glory": {
    "type": "minecraft:block",
    "functions": [
      {
        "function": "minecraft:explosion_decay"
      }
    ],
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:morning_glory"
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "block": "psychedelicraft:morning_glory",
            "condition": "minecraft:block_state_property",
            "properties": {
              "age": "4"
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "enchantment": "minecraft:fortune",
                "formula": "minecraft:binomial_with_bonus_count",
                "function": "minecraft:apply_bonus",
                "parameters": {
                  "extra": 3,
                  "probability": 0.5714286
                }
              }
            ],
            "name": "psychedelicraft:morning_glory_seeds"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/morning_glory_lattice": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:morning_glory"
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:lattice"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/morning_glory_lattice_farming": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 4,
                  "min": 3
                },
                "function": "minecraft:set_count"
              },
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:morning_glory"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/oak_barrel": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:dynamic",
            "name": "minecraft:contents"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/peyote": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "conditions": [
              {
                "block": "psychedelicraft:peyote",
                "condition": "minecraft:block_state_property",
                "properties": {
                  "age": "0"
                }
              }
            ],
            "functions": [
              {
                "add": false,
                "count": 1,
                "function": "minecraft:set_count"
              },
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:peyote"
          },
          {
            "type": "minecraft:item",
            "conditions": [
              {
                "block": "psychedelicraft:peyote",
                "condition": "minecraft:block_state_property",
                "properties": {
                  "age": "1"
                }
              }
            ],
            "functions": [
              {
                "add": false,
                "count": 2,
                "function": "minecraft:set_count"
              },
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:peyote"
          },
          {
            "type": "minecraft:item",
            "conditions": [
              {
                "block": "psychedelicraft:peyote",
                "condition": "minecraft:block_state_property",
                "properties": {
                  "age": "2"
                }
              }
            ],
            "functions": [
              {
                "add": false,
                "count": 3,
                "function": "minecraft:set_count"
              },
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:peyote"
          },
          {
            "type": "minecraft:item",
            "conditions": [
              {
                "block": "psychedelicraft:peyote",
                "condition": "minecraft:block_state_property",
                "properties": {
                  "age": "3"
                }
              }
            ],
            "functions": [
              {
                "add": false,
                "count": 4,
                "function": "minecraft:set_count"
              },
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:peyote"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/potted_cannabis": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "minecraft:flower_pot"
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:cannabis_seeds"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/potted_coca": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "minecraft:flower_pot"
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:coca_seeds"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/potted_coffea": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "minecraft:flower_pot"
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:coffea_cherries"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/potted_hop": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "minecraft:flower_pot"
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:hop_seeds"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/potted_juniper_sapling": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "minecraft:flower_pot"
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:juniper_sapling"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/potted_tobacco": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "minecraft:flower_pot"
          }
        ],
        "rolls": 1
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:tobacco_seeds"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/spruce_barrel": {
    "type": "minecraft:block",
    "pools": [
      {
        "rolls": 1,
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:spruce_barrel"
          }
        ],
        "conditions": [
          {
            "condition": "minecraft:survives_explosion"
          }
        ]
      }
    ]
  },
  "blocks/tobacco": {
    "type": "minecraft:block",
    "functions": [
      {
        "function": "minecraft:explosion_decay"
      }
    ],
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:alternatives",
            "children": [
              {
                "type": "minecraft:item",
                "conditions": [
                  {
                    "block": "psychedelicraft:tobacco",
                    "condition": "minecraft:block_state_property",
                    "properties": {
                      "age": {
                        "min": "1",
                        "max": "7"
                      }
                    }
                  }
                ],
                "name": "psychedelicraft:tobacco"
              },
              {
                "type": "minecraft:item",
                "name": "psychedelicraft:tobacco_seeds"
              }
            ]
          }
        ],
        "rolls": 2
      },
      {
        "bonus_rolls": 0,
        "conditions": [
          {
            "block": "psychedelicraft:tobacco",
            "condition": "minecraft:block_state_property",
            "properties": {
              "age": "7",
              "top": "true"
            }
          }
        ],
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "enchantment": "minecraft:fortune",
                "formula": "minecraft:binomial_with_bonus_count",
                "function": "minecraft:apply_bonus",
                "parameters": {
                  "extra": 3,
                  "probability": 0.5714286
                }
              }
            ],
            "name": "psychedelicraft:tobacco_seeds"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/wine_grape_lattice": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:wine_grapes"
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:lattice"
          }
        ],
        "rolls": 1
      }
    ]
  },
  "blocks/wine_grape_lattice_farming": {
    "type": "minecraft:block",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 4,
                  "min": 3
                },
                "function": "minecraft:set_count"
              },
              {
                "function": "minecraft:explosion_decay"
              }
            ],
            "name": "psychedelicraft:wine_grapes"
          }
        ],
        "rolls": 1
      }
    ]
  }
};
export const CHEST_LOOT = {
  "chests/abandoned_mineshaft": {
    "type": "minecraft:chest",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 8,
                  "min": 3
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wine_grapes",
            "weight": 8
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 2
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 5
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 8,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:juniper_berries",
            "weight": 2
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:dried_tobacco",
            "weight": 6
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 1,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:smoking_pipe",
            "weight": 3
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 8,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:cigarette",
            "weight": 5
          }
        ],
        "rolls": 1
      }
    ]
  },
  "chests/simple_dungeon": {
    "type": "minecraft:chest",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 8,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wine_grapes",
            "weight": 8
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 4,
                  "min": 2
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:glass_chalice",
            "weight": 5
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 2
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 8,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:juniper_berries",
            "weight": 10
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:dried_tobacco",
            "weight": 3
          }
        ],
        "rolls": 1
      }
    ]
  },
  "chests/village/village_shepherd": {
    "type": "minecraft:chest",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:cigarette",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 4,
                  "min": 1
                },
                "function": "minecraft:set_count"
              },
              {
                "add": false,
                "tag": "{ \"fluid\": { \"id\": \"psychedelicraft:coffee\", \"level\": 500 } }",
                "function": "minecraft:set_nbt"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 3
          }
        ],
        "rolls": {
          "type": "minecraft:uniform",
          "max": 8,
          "min": 3
        }
      }
    ]
  },
  "chests/village/village_tannery": {
    "type": "minecraft:chest",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 11,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:cigarette",
            "weight": 4
          }
        ],
        "rolls": {
          "type": "minecraft:uniform",
          "max": 8,
          "min": 3
        }
      }
    ]
  },
  "chests/village/village_temple": {
    "type": "minecraft:chest",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 10,
                  "min": 3
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wine_grapes",
            "weight": 8
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:cigarette",
            "weight": 2
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 4,
                  "min": 1
                },
                "function": "minecraft:set_count"
              },
              {
                "add": false,
                "tag": "{ \"fluid\": { \"id\": \"psychedelicraft:coffee\", \"level\": 500 } }",
                "function": "minecraft:set_nbt"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 3
          },
          {
            "type": "minecraft:item",
            "name": "psychedelicraft:stone_cup"
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 8,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:hash_muffin",
            "weight": 1
          }
        ],
        "rolls": {
          "type": "minecraft:uniform",
          "max": 8,
          "min": 3
        }
      }
    ]
  },
  "chests/village/village_toolsmith": {
    "type": "minecraft:chest",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 3,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 10
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:cigarette",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 4,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:cigar",
            "weight": 2
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": 1,
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:joint",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 4,
                  "min": 1
                },
                "function": "minecraft:set_count"
              },
              {
                "add": false,
                "tag": "{ \"fluid\": { \"id\": \"psychedelicraft:coffee\", \"level\": 500 } }",
                "function": "minecraft:set_nbt"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "tag": "{ \"fluid\": { \"id\": \"psychedelicraft:peyote_juice\", \"level\": 50 } }",
                "function": "minecraft:set_nbt"
              }
            ],
            "name": "psychedelicraft:stone_cup",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "tag": "{ \"fluid\": { \"id\": \"psychedelicraft:cocaine\", \"level\": 10 } }",
                "function": "minecraft:set_nbt"
              }
            ],
            "name": "psychedelicraft:syringe",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "tag": "{ \"fluid\": { \"id\": \"psychedelicraft:caffeine\", \"level\": 10 } }",
                "function": "minecraft:set_nbt"
              }
            ],
            "name": "psychedelicraft:syringe",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 8,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:hash_muffin",
            "weight": 1
          }
        ],
        "rolls": {
          "type": "minecraft:uniform",
          "max": 8,
          "min": 3
        }
      }
    ]
  },
  "chests/village/village_weaponsmith": {
    "type": "minecraft:chest",
    "pools": [
      {
        "bonus_rolls": 0,
        "entries": [
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 3
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 16,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:cigarette",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 2,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:cigar",
            "weight": 2
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 4,
                  "min": 1
                },
                "function": "minecraft:set_count"
              },
              {
                "add": false,
                "tag": "{ \"fluid\": { \"id\": \"psychedelicraft:coffee\", \"level\": 500 } }",
                "function": "minecraft:set_nbt"
              }
            ],
            "name": "psychedelicraft:wooden_mug",
            "weight": 1
          },
          {
            "type": "minecraft:item",
            "functions": [
              {
                "add": false,
                "count": {
                  "type": "minecraft:uniform",
                  "max": 8,
                  "min": 1
                },
                "function": "minecraft:set_count"
              }
            ],
            "name": "psychedelicraft:hash_muffin",
            "weight": 3
          }
        ],
        "rolls": {
          "type": "minecraft:uniform",
          "max": 8,
          "min": 3
        }
      }
    ]
  }
};
